import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = { DB: D1Database }
const admin = new Hono<{ Bindings: Bindings }>()

async function getUser(c: any) {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return null
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return null
  return await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<any>()
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'jochu_salt_2024')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

// ユーザー一覧
admin.get('/users', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const users = await c.env.DB.prepare(
    'SELECT id, username, role, name, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, avatar_url, first_login, created_at FROM users ORDER BY role, grade, class_num, number'
  ).all<any>()

  return c.json({ users: users.results })
})

// ユーザー更新（先生は管理者のアカウント変更不可）
admin.put('/users/:id', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const targetId = parseInt(c.req.param('id'))
  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetId).first<any>()
  if (!target) return c.json({ error: 'User not found' }, 404)

  // 先生は管理者アカウントの変更不可
  if (user.role === 'teacher' && target.role === 'admin') {
    return c.json({ error: '管理者アカウントは変更できません' }, 403)
  }
  // 先生は先生の権限をadminには変更不可
  const body = await c.req.json()
  if (user.role === 'teacher' && body.role === 'admin') {
    return c.json({ error: '管理者権限は付与できません' }, 403)
  }

  const { name, role, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, password } = body

  let fields: string[] = ['updated_at = datetime("now")']
  let params: any[] = []

  if (name !== undefined) { fields.push('name = ?'); params.push(name) }
  if (role !== undefined) { fields.push('role = ?'); params.push(role) }
  if (grade !== undefined) { fields.push('grade = ?'); params.push(grade) }
  if (class_num !== undefined) { fields.push('class_num = ?'); params.push(class_num) }
  if (number !== undefined) { fields.push('number = ?'); params.push(number) }
  if (club !== undefined) { fields.push('club = ?'); params.push(club) }
  if (committee !== undefined) { fields.push('committee = ?'); params.push(committee) }
  if (subject !== undefined) { fields.push('subject = ?'); params.push(subject) }
  if (is_homeroom !== undefined) { fields.push('is_homeroom = ?'); params.push(is_homeroom ? 1 : 0) }
  if (homeroom_class !== undefined) { fields.push('homeroom_class = ?'); params.push(homeroom_class) }
  if (password) {
    const hash = await hashPassword(password)
    fields.push('password_hash = ?')
    params.push(hash)
  }

  params.push(targetId)
  await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run()

  return c.json({ success: true })
})

// ユーザー削除（先生は管理者削除不可）
admin.delete('/users/:id', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const targetId = parseInt(c.req.param('id'))
  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetId).first<any>()
  if (!target) return c.json({ error: 'User not found' }, 404)

  if (user.role === 'teacher' && target.role === 'admin') {
    return c.json({ error: '管理者アカウントは削除できません' }, 403)
  }
  if (targetId === user.id) return c.json({ error: '自分自身は削除できません' }, 400)

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run()
  return c.json({ success: true })
})

// 登録トークン発行
admin.post('/tokens', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const { role, hours, count } = await c.req.json()
  const expiresAt = new Date(Date.now() + (hours || 24) * 60 * 60 * 1000).toISOString()

  const tokens: string[] = []
  const generateCount = Math.min(count || 1, 100)

  for (let i = 0; i < generateCount; i++) {
    const token = crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()
    await c.env.DB.prepare(
      'INSERT INTO registration_tokens (token, role, expires_at, created_by) VALUES (?, ?, ?, ?)'
    ).bind(token, role || 'student', expiresAt, user.id).run()
    tokens.push(token)
  }

  return c.json({ success: true, tokens, expires_at: expiresAt })
})

// 一括ユーザー生成（生徒）
admin.post('/bulk-create/students', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const { year, class_num, count, password } = await c.req.json()
  const yearShort = String(year).slice(-2)
  const created: string[] = []
  const defaultPass = password || 'password'
  const hash = await hashPassword(defaultPass)

  for (let num = 1; num <= count; num++) {
    const username = `${yearShort}${String(class_num).padStart(1, '0')}${String(num).padStart(2, '0')}`
    try {
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO users (username, password_hash, role, grade, class_num, number) VALUES (?, ?, "student", ?, ?, ?)'
      ).bind(username, hash, Math.ceil(class_num / 10) || 1, class_num, num).run()
      created.push(username)
    } catch (e) {}
  }

  return c.json({ success: true, created, count: created.length })
})

// 一括ユーザー生成（先生）
admin.post('/bulk-create/teachers', async (c) => {
  const user = await getUser(c)
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden（管理者のみ）' }, 403)

  const { count, password } = await c.req.json()
  const defaultPass = password || 'teacher1234'
  const hash = await hashPassword(defaultPass)
  const created: string[] = []

  // 現在の最大先生番号を取得
  const maxTeacher = await c.env.DB.prepare(
    "SELECT username FROM users WHERE username LIKE 'T%' ORDER BY username DESC LIMIT 1"
  ).first<any>()
  let startNum = 1
  if (maxTeacher) {
    const n = parseInt(maxTeacher.username.replace('T', ''))
    if (!isNaN(n)) startNum = n + 1
  }

  for (let i = 0; i < count; i++) {
    const username = `T${String(startNum + i).padStart(3, '0')}`
    try {
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, "teacher")'
      ).bind(username, hash).run()
      created.push(username)
    } catch (e) {}
  }

  return c.json({ success: true, created, count: created.length })
})

// 統計情報
admin.get('/stats', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const total = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first<any>()
  const byRole = await c.env.DB.prepare(
    'SELECT role, COUNT(*) as cnt FROM users GROUP BY role'
  ).all<any>()
  const byClub = await c.env.DB.prepare(
    "SELECT club, COUNT(*) as cnt FROM users WHERE club IS NOT NULL AND club != '' GROUP BY club ORDER BY cnt DESC"
  ).all<any>()
  const byCommittee = await c.env.DB.prepare(
    "SELECT committee, COUNT(*) as cnt FROM users WHERE committee IS NOT NULL AND committee != '' GROUP BY committee ORDER BY cnt DESC"
  ).all<any>()
  const byGrade = await c.env.DB.prepare(
    'SELECT grade, COUNT(*) as cnt FROM users WHERE grade IS NOT NULL GROUP BY grade'
  ).all<any>()

  return c.json({
    total: total?.cnt || 0,
    byRole: byRole.results,
    byClub: byClub.results,
    byCommittee: byCommittee.results,
    byGrade: byGrade.results
  })
})

// システム診断
admin.get('/diagnose', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const checks: any[] = []

  try {
    await c.env.DB.prepare('SELECT 1').first()
    checks.push({ name: 'データベース', status: 'ok', message: '正常' })
  } catch (e) {
    checks.push({ name: 'データベース', status: 'error', message: 'DB接続エラー' })
  }

  const expiredSessions = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM sessions WHERE expires_at < datetime("now")'
  ).first<any>()
  checks.push({ name: '期限切れセッション', status: 'info', message: `${expiredSessions?.cnt || 0}件` })

  const expiredPosts = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM posts WHERE expires_at < datetime("now")'
  ).first<any>()
  checks.push({ name: '期限切れ投稿', status: 'info', message: `${expiredPosts?.cnt || 0}件（自動削除対象）` })

  const expiredQuestions = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM questions WHERE expires_at < datetime("now")'
  ).first<any>()
  checks.push({ name: '期限切れ質問', status: 'info', message: `${expiredQuestions?.cnt || 0}件（自動削除対象）` })

  // 期限切れのものを削除
  await c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < datetime("now")').run()
  await c.env.DB.prepare('DELETE FROM posts WHERE expires_at IS NOT NULL AND expires_at < datetime("now")').run()
  await c.env.DB.prepare('DELETE FROM questions WHERE expires_at IS NOT NULL AND expires_at < datetime("now")').run()

  checks.push({ name: 'クリーンアップ', status: 'ok', message: '期限切れデータを削除しました' })

  return c.json({ status: 'ok', checks, timestamp: new Date().toISOString() })
})

// 投稿管理一覧
admin.get('/posts', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const allPosts = await c.env.DB.prepare(
    'SELECT p.*, u.name as author_name FROM posts p JOIN users u ON p.author_id = u.id ORDER BY p.created_at DESC LIMIT 200'
  ).all<any>()

  return c.json({ posts: allPosts.results })
})

// 通知設定取得
admin.get('/notifications/settings', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const settings = await c.env.DB.prepare(
    'SELECT * FROM notification_settings WHERE user_id = ?'
  ).bind(user.id).first<any>()

  return c.json({ settings })
})

// 通知設定更新
admin.put('/notifications/settings', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { push_enabled, disaster_enabled, club_post_enabled, committee_post_enabled, school_notice_enabled, message_enabled, push_subscription } = body

  const existing = await c.env.DB.prepare('SELECT id FROM notification_settings WHERE user_id = ?').bind(user.id).first()
  if (existing) {
    await c.env.DB.prepare(`
      UPDATE notification_settings SET 
        push_enabled = ?, disaster_enabled = ?, club_post_enabled = ?,
        committee_post_enabled = ?, school_notice_enabled = ?, message_enabled = ?,
        push_subscription = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).bind(push_enabled ? 1 : 0, disaster_enabled ? 1 : 0, club_post_enabled ? 1 : 0,
      committee_post_enabled ? 1 : 0, school_notice_enabled ? 1 : 0, message_enabled ? 1 : 0,
      push_subscription || null, user.id).run()
  } else {
    await c.env.DB.prepare(`
      INSERT INTO notification_settings (user_id, push_enabled, disaster_enabled, club_post_enabled, committee_post_enabled, school_notice_enabled, message_enabled, push_subscription)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(user.id, push_enabled ? 1 : 0, disaster_enabled ? 1 : 0, club_post_enabled ? 1 : 0,
      committee_post_enabled ? 1 : 0, school_notice_enabled ? 1 : 0, message_enabled ? 1 : 0,
      push_subscription || null).run()
  }

  return c.json({ success: true })
})

// 全体通知送信（管理者・先生）
admin.post('/notifications/broadcast', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const { title, body, type } = await c.req.json()
  const allUsers = await c.env.DB.prepare('SELECT id FROM users').all<any>()

  for (const u of allUsers.results) {
    await c.env.DB.prepare(
      'INSERT INTO notifications (user_id, type, title, body, created_by) VALUES (?, ?, ?, ?, ?)'
    ).bind(u.id, type || 'normal', title, body, user.id).run()
  }

  return c.json({ success: true, sent: allUsers.results.length })
})

// 自分通知
admin.post('/notifications/self', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { title, body, scheduled_at } = await c.req.json()
  await c.env.DB.prepare(
    'INSERT INTO notifications (user_id, type, title, body, scheduled_at, created_by) VALUES (?, "self", ?, ?, ?, ?)'
  ).bind(user.id, title, body, scheduled_at || null, user.id).run()

  return c.json({ success: true })
})

// プロフィール更新許可
admin.post('/users/:id/allow-profile-edit', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const targetId = parseInt(c.req.param('id'))
  const { expires_at } = await c.req.json()

  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO profile_edit_permissions (user_id, granted_by, expires_at) VALUES (?, ?, ?)'
  ).bind(targetId, user.id, expires_at || null).run()

  return c.json({ success: true })
})

// 自分のプロフィール更新
admin.put('/profile', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { name, bio, avatar_url, password, club, committee, class_num, number, grade } = body

  // 制限付きフィールドの変更権限チェック
  const sensitiveFields = [club, committee, class_num, number, grade]
  const hasSensitive = sensitiveFields.some(f => f !== undefined)

  if (hasSensitive) {
    if (['admin', 'teacher'].includes(user.role)) {
      // OK
    } else {
      const perm = await c.env.DB.prepare(
        'SELECT * FROM profile_edit_permissions WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime("now"))'
      ).bind(user.id).first()
      if (!perm) return c.json({ error: '変更の許可が必要です' }, 403)
    }
  }

  let fields: string[] = ['updated_at = datetime("now")']
  let params: any[] = []

  if (name !== undefined) { fields.push('name = ?'); params.push(name) }
  if (bio !== undefined) { fields.push('bio = ?'); params.push(bio) }
  if (avatar_url !== undefined) { fields.push('avatar_url = ?'); params.push(avatar_url) }
  if (club !== undefined) { fields.push('club = ?'); params.push(club) }
  if (committee !== undefined) { fields.push('committee = ?'); params.push(committee) }
  if (class_num !== undefined) { fields.push('class_num = ?'); params.push(class_num) }
  if (number !== undefined) { fields.push('number = ?'); params.push(number) }
  if (grade !== undefined) { fields.push('grade = ?'); params.push(grade) }

  if (password) {
    const hash = await hashPassword(password)
    fields.push('password_hash = ?')
    params.push(hash)
  }

  params.push(user.id)
  await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run()

  const updated = await c.env.DB.prepare(
    'SELECT id, username, role, name, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, avatar_url, bio FROM users WHERE id = ?'
  ).bind(user.id).first()

  return c.json({ success: true, user: updated })
})

// 教員一覧（相談所・メッセージ用）
admin.get('/teachers', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const teachers = await c.env.DB.prepare(
    "SELECT id, name, subject, is_homeroom, homeroom_class FROM users WHERE role IN ('teacher', 'admin') ORDER BY name"
  ).all<any>()

  return c.json({ teachers: teachers.results })
})

export default admin
