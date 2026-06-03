import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import webpush from 'web-push'

type Bindings = { DB: any }
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

async function getUserRoles(db: any, userId: number): Promise<string[]> {
  const roles = await db.prepare('SELECT role FROM user_roles WHERE user_id = ?').bind(userId).all<any>()
  return roles.results.map(r => r.role)
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'jochu_salt_2024')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

function isStaff(roles: string[]): boolean {
  return roles.some((r: string) => ['admin', 'teacher'].includes(r))
}

function isAdmin(roles: string[]): boolean {
  return roles.includes('admin')
}

// ユーザー一覧
admin.get('/users', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const users = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.login_id, u.role, u.name, u.grade, u.class_num, u.number, u.club, u.committee, u.subject, 
     u.is_homeroom, u.homeroom_class, u.avatar_url, u.first_login, u.created_at,
     (SELECT GROUP_CONCAT(role) FROM user_roles WHERE user_id = u.id) as all_roles
     FROM users u ORDER BY u.role, u.grade, u.class_num, u.number`
  ).all<any>()

  return c.json({ users: users.results })
})

// ユーザー更新
admin.put('/users/:id', async (c) => {
  const user = await getUser(c)
  const myRoles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(myRoles)) return c.json({ error: 'Forbidden' }, 403)

  const targetId = parseInt(c.req.param('id'))
  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetId).first<any>()
  if (!target) return c.json({ error: 'User not found' }, 404)

  const targetRoles = await getUserRoles(c.env.DB, targetId)

  if (!isAdmin(myRoles) && targetRoles.includes('admin')) {
    return c.json({ error: '管理者アカウントは変更できません' }, 403)
  }

  const body = await c.req.json()
  const { name, role, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, password, login_id, roles: newRoles } = body

  let fields: string[] = ['updated_at = datetime("now")']
  let params: any[] = []

  if (name !== undefined) { fields.push('name = ?'); params.push(name) }
  if (grade !== undefined) { fields.push('grade = ?'); params.push(grade) }
  if (class_num !== undefined) { fields.push('class_num = ?'); params.push(class_num) }
  if (number !== undefined) { fields.push('number = ?'); params.push(number) }
  if (club !== undefined) { fields.push('club = ?'); params.push(club) }
  if (committee !== undefined) { fields.push('committee = ?'); params.push(committee) }
  if (subject !== undefined) { fields.push('subject = ?'); params.push(subject) }
  if (is_homeroom !== undefined) { fields.push('is_homeroom = ?'); params.push(is_homeroom ? 1 : 0) }
  if (homeroom_class !== undefined) { fields.push('homeroom_class = ?'); params.push(homeroom_class) }
  if (login_id !== undefined) { fields.push('login_id = ?'); params.push(login_id) }
  if (role !== undefined && !isAdmin(myRoles) && role === 'admin') {
    return c.json({ error: '管理者権限は付与できません' }, 403)
  }
  if (role !== undefined) { fields.push('role = ?'); params.push(role) }
  if (password) {
    const hash = await hashPassword(password)
    fields.push('password_hash = ?')
    params.push(hash)
  }

  if (fields.length > 1) {
    params.push(targetId)
    await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run()
  }

  // 複数ロール更新
  if (newRoles && Array.isArray(newRoles)) {
    await c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(targetId).run()
    for (const r of newRoles) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)')
        .bind(targetId, r).run()
    }
  }

  return c.json({ success: true })
})

// ロール追加
admin.post('/users/:id/roles', async (c) => {
  const user = await getUser(c)
  const myRoles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(myRoles)) return c.json({ error: 'Forbidden' }, 403)
  const targetId = parseInt(c.req.param('id'))
  const { role } = await c.req.json()
  if (!role) return c.json({ error: 'ロールが必要です' }, 400)
  if (!isAdmin(myRoles) && ['admin'].includes(role)) {
    return c.json({ error: '管理者権限は付与できません' }, 403)
  }
  await c.env.DB.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(targetId, role).run()
  return c.json({ success: true })
})

// ロール削除
admin.delete('/users/:id/roles/:role', async (c) => {
  const user = await getUser(c)
  const myRoles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(myRoles)) return c.json({ error: 'Forbidden' }, 403)
  const targetId = parseInt(c.req.param('id'))
  const role = c.req.param('role')
  if (!isAdmin(myRoles) && ['admin'].includes(role)) {
    return c.json({ error: '管理者権限は変更できません' }, 403)
  }
  await c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ?').bind(targetId, role).run()
  return c.json({ success: true })
})

// ユーザー削除（個別）
admin.delete('/users/:id', async (c) => {
  const user = await getUser(c)
  const myRoles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(myRoles)) return c.json({ error: 'Forbidden' }, 403)

  const targetId = parseInt(c.req.param('id'))
  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetId).first<any>()
  if (!target) return c.json({ error: 'User not found' }, 404)

  const targetRoles = await getUserRoles(c.env.DB, targetId)
  if (!isAdmin(myRoles) && targetRoles.includes('admin')) {
    return c.json({ error: '管理者アカウントは削除できません' }, 403)
  }
  if (targetId === user.id) return c.json({ error: '自分自身は削除できません' }, 400)

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run()
  return c.json({ success: true })
})

// ユーザー一括削除（学年・クラス指定）
admin.post('/users/bulk-delete', async (c) => {
  const user = await getUser(c)
  const myRoles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isAdmin(myRoles)) return c.json({ error: 'Forbidden（管理者のみ）' }, 403)

  const { grade, class_num } = await c.req.json()
  if (!grade) return c.json({ error: '学年は必須です' }, 400)

  let query = 'SELECT id, name, username FROM users WHERE grade = ?'
  let params: any[] = [grade]

  if (class_num) {
    query += ' AND class_num = ?'
    params.push(class_num)
  }

  const targets = await c.env.DB.prepare(query).bind(...params).all<any>()

  if (targets.results.length === 0) {
    return c.json({ error: '該当するユーザーがいません' }, 404)
  }

  // 管理者自身は削除しない
  const toDelete = targets.results.filter((t: any) => t.id !== user.id)
  const ids = toDelete.map((t: any) => t.id)

  if (ids.length === 0) return c.json({ error: '削除できるユーザーがいません' }, 400)

  const placeholders = ids.map(() => '?').join(',')
  await c.env.DB.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).bind(...ids).run()

  return c.json({ success: true, deleted: ids.length, users: toDelete })
})

// 登録トークン発行
admin.post('/tokens', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

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
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const { year, class_num, count, start_num, password } = await c.req.json()
  const yearShort = String(year).slice(-2)
  const created: string[] = []
  const defaultPass = password || 'password'
  const hash = await hashPassword(defaultPass)
  const numStart = start_num || 1

  for (let i = 0; i < count; i++) {
    const num = numStart + i
    const username = `${yearShort}${String(class_num).padStart(1, '0')}${String(num).padStart(2, '0')}`
    const displayName = `${year}年度 ${class_num}組${num}番`
    try {
      const result = await c.env.DB.prepare(
        'INSERT OR IGNORE INTO users (username, password_hash, login_id, role, name, grade, class_num, number) VALUES (?, ?, ?, "student", ?, ?, ?, ?)'
      ).bind(username, hash, username, displayName, year, class_num, num).run()

      if (result.meta.last_row_id) {
        await c.env.DB.prepare(
          'INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, "student")'
        ).bind(result.meta.last_row_id).run()
      }
      created.push(username)
    } catch (e) {}
  }

  return c.json({ success: true, created, count: created.length })
})

// 一括ユーザー生成（先生）
admin.post('/bulk-create/teachers', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isAdmin(roles)) return c.json({ error: 'Forbidden（管理者のみ）' }, 403)

  const { count, password } = await c.req.json()
  const defaultPass = password || 'teacher1234'
  const hash = await hashPassword(defaultPass)
  const created: string[] = []

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
    const displayName = `${username} 先生`
    try {
      const result = await c.env.DB.prepare(
        'INSERT OR IGNORE INTO users (username, password_hash, login_id, role, name) VALUES (?, ?, ?, "teacher", ?)'
      ).bind(username, hash, username, displayName).run()
      if (result.meta.last_row_id) {
        await c.env.DB.prepare(
          'INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, "teacher")'
        ).bind(result.meta.last_row_id).run()
      }
      created.push(username)
    } catch (e) {}
  }

  return c.json({ success: true, created, count: created.length })
})

// 統計情報
admin.get('/stats', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const total = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first<any>()
  const byRole = await c.env.DB.prepare(
    'SELECT role, COUNT(*) as cnt FROM user_roles GROUP BY role'
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

// 存在するクラス一覧
admin.get('/classes', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const result = await c.env.DB.prepare(
    'SELECT DISTINCT grade, class_num FROM users WHERE grade IS NOT NULL AND class_num IS NOT NULL ORDER BY grade, class_num'
  ).all<any>()
  return c.json({ classes: result.results || [] })
})

// システム診断
admin.get('/diagnose', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

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

  // クリーンアップ
  await c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < datetime("now")').run()
  await c.env.DB.prepare('DELETE FROM posts WHERE expires_at IS NOT NULL AND expires_at < datetime("now")').run()
  await c.env.DB.prepare('DELETE FROM questions WHERE expires_at IS NOT NULL AND expires_at < datetime("now")').run()

  checks.push({ name: 'クリーンアップ', status: 'ok', message: '期限切れデータを削除しました' })

  return c.json({ status: 'ok', checks, timestamp: new Date().toISOString() })
})

// 互換性: diagnosticsエイリアス
admin.get('/diagnostics', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const checks: any[] = []

  // DB基本
  try {
    await c.env.DB.prepare('SELECT 1').first()
    checks.push({ name: 'データベース接続', status: 'ok', message: '正常' })
  } catch { checks.push({ name: 'データベース接続', status: 'error', message: '接続エラー' }) }

  // 全テーブルチェック
  const tables = ['users', 'posts', 'messages', 'message_threads', 'thread_members', 'notifications', 'surveys', 'survey_answers', 'questions', 'pe_checklist_items', 'pe_checklist_logs', 'pe_rentals', 'user_roles', 'admin_settings', 'files', 'sessions', 'notification_settings', 'profile_change_requests']
  let tableOk = 0, tableNg = 0
  for (const t of tables) {
    try {
      const r = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).first<any>()
      checks.push({ name: `テーブル: ${t}`, status: 'ok', message: `${r?.cnt || 0}件` })
      tableOk++
    } catch { checks.push({ name: `テーブル: ${t}`, status: 'error', message: '存在しません' }); tableNg++ }
  }
  checks.push({ name: 'テーブル整合性', status: tableNg === 0 ? 'ok' : 'error', message: `${tableOk}/${tables.length} OK, ${tableNg} NG` })

  // クリーンアップ統計
  const expiredSessions = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM sessions WHERE expires_at < datetime("now")').first<any>()
  checks.push({ name: '期限切れセッション', status: 'info', message: `${expiredSessions?.cnt || 0}件` })
  const expiredPosts = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM posts WHERE expires_at < datetime("now")').first<any>()
  checks.push({ name: '期限切れ投稿', status: 'info', message: `${expiredPosts?.cnt || 0}件` })
  const expiredQuestions = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM questions WHERE expires_at < datetime("now")').first<any>()
  checks.push({ name: '期限切れ質問', status: 'info', message: `${expiredQuestions?.cnt || 0}件` })

  // ユーザー統計
  const userStats = await c.env.DB.prepare(
    'SELECT role, COUNT(*) as cnt FROM users GROUP BY role'
  ).all<any>()
  const roleSummary = userStats.results.map(r => `${r.role}:${r.cnt}`).join(', ')
  checks.push({ name: 'ユーザー数', status: 'info', message: roleSummary || 'データなし' })

  // JMA天気API
  try {
    const jmaRes = await fetch('https://www.jma.go.jp/bosai/forecast/data/forecast/110000.json', { signal: AbortSignal.timeout(5000) })
    if (jmaRes.ok) {
      const jmaData = await jmaRes.json()
      const ok = Array.isArray(jmaData) && jmaData.length > 0 && jmaData[0]?.publishingOffice
      checks.push({ name: 'JMA天気API', status: ok ? 'ok' : 'error', message: ok ? `${jmaData[0].publishingOffice} 取得OK` : '応答が不正' })
    } else {
      checks.push({ name: 'JMA天気API', status: 'error', message: `HTTP ${jmaRes.status}` })
    }
  } catch { checks.push({ name: 'JMA天気API', status: 'error', message: 'タイムアウト/接続失敗' }) }

  // JMA警報API
  try {
    const warnRes = await fetch('https://www.jma.go.jp/bosai/warning/data/warning/110000.json', { signal: AbortSignal.timeout(5000) })
    checks.push({ name: 'JMA警報API', status: warnRes.ok ? 'ok' : 'error', message: warnRes.ok ? '取得OK' : `HTTP ${warnRes.status}` })
  } catch { checks.push({ name: 'JMA警報API', status: 'error', message: 'タイムアウト/接続失敗' }) }

  // Open-Meteo API
  try {
    const omRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.8397&longitude=139.3912&current=temperature_2m', { signal: AbortSignal.timeout(5000) })
    if (omRes.ok) {
      const omData = await omRes.json()
      const ok = omData?.current?.temperature_2m != null
      checks.push({ name: 'Open-Meteo API', status: ok ? 'ok' : 'error', message: ok ? `${omData.current.temperature_2m}°C 取得OK` : '応答が不正' })
    } else {
      checks.push({ name: 'Open-Meteo API', status: 'error', message: `HTTP ${omRes.status}` })
    }
  } catch { checks.push({ name: 'Open-Meteo API', status: 'error', message: 'タイムアウト/接続失敗' }) }

  // 環境変数
  const envOk = !!c.env.DB
  checks.push({ name: '環境変数(DB)', status: envOk ? 'ok' : 'error', message: envOk ? '設定済み' : '未設定' })

  // サーバー時刻
  const now = new Date()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '不明'
  checks.push({ name: 'サーバー時刻', status: 'info', message: `${now.toISOString()} (${tz})` })

  checks.push({ name: '診断日時', status: 'info', message: new Date().toLocaleString('ja-JP') })

  // クリーンアップ
  await c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < datetime("now")').run()
  await c.env.DB.prepare('DELETE FROM posts WHERE expires_at IS NOT NULL AND expires_at < datetime("now")').run()
  await c.env.DB.prepare('DELETE FROM questions WHERE expires_at IS NOT NULL AND expires_at < datetime("now")').run()

  return c.json({ status: 'ok', checks, timestamp: new Date().toISOString() })
})

// 投稿管理一覧
admin.get('/posts', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const allPosts = await c.env.DB.prepare(
    'SELECT p.*, u.name as author_name FROM posts p JOIN users u ON p.author_id = u.id ORDER BY p.created_at DESC LIMIT 200'
  ).all<any>()

  return c.json({ posts: allPosts.results })
})

// 投稿一括削除
admin.post('/posts/bulk-delete', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)
  const { ids } = await c.req.json()
  if (!ids || !ids.length) return c.json({ error: 'No ids' }, 400)
  const placeholders = ids.map(() => '?').join(',')
  await c.env.DB.prepare(`DELETE FROM posts WHERE id IN (${placeholders})`).bind(...ids).run()
  return c.json({ success: true, deleted: ids.length })
})

// パスワード変更（管理者がユーザーのパスワード変更）
admin.post('/users/:id/change-password', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isAdmin(roles)) return c.json({ error: 'Forbidden（管理者のみ）' }, 403)
  const targetId = parseInt(c.req.param('id'))
  const { password } = await c.req.json()
  if (!password) return c.json({ error: 'パスワードが必要です' }, 400)
  const hash = await hashPassword(password)
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, targetId).run()
  return c.json({ success: true })
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

  // 複数購読を管理: push_subscriptions JSON配列に追加
  let subs: any[] = []
  if (push_subscription) {
    const existing = await c.env.DB.prepare('SELECT push_subscription FROM notification_settings WHERE user_id = ?').bind(user.id).first<any>()
    if (existing && existing.push_subscription) {
      try { subs = JSON.parse(existing.push_subscription) } catch { subs = [] }
      if (!Array.isArray(subs)) subs = [subs]
    }
    const newSub = typeof push_subscription === 'string' ? JSON.parse(push_subscription) : push_subscription
    const idx = subs.findIndex((s: any) => s.endpoint === newSub.endpoint)
    if (idx >= 0) subs[idx] = newSub
    else subs.push(newSub)
  }

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
      subs.length > 0 ? JSON.stringify(subs) : (push_subscription || null), user.id).run()
  } else {
    await c.env.DB.prepare(`
      INSERT INTO notification_settings (user_id, push_enabled, disaster_enabled, club_post_enabled, committee_post_enabled, school_notice_enabled, message_enabled, push_subscription)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(user.id, push_enabled ? 1 : 0, disaster_enabled ? 1 : 0, club_post_enabled ? 1 : 0,
      committee_post_enabled ? 1 : 0, school_notice_enabled ? 1 : 0, message_enabled ? 1 : 0,
      subs.length > 0 ? JSON.stringify(subs) : (push_subscription || null)).run()
  }

  return c.json({ success: true })
})

// 全体通知送信
admin.post('/notifications/broadcast', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  try {
    const { title, body, type } = await c.req.json()
    const allUsers = await c.env.DB.prepare('SELECT id FROM users').all<any>()

    const pushUsers = await c.env.DB.prepare(
      "SELECT user_id, push_subscription FROM notification_settings WHERE push_enabled = 1 AND push_subscription IS NOT NULL AND push_subscription != ''"
    ).all<any>()

    const payload = JSON.stringify({ title, body, type: type || 'normal' })

    // DB通知の作成（全ユーザー分を一括で非同期実行）
    await Promise.all(allUsers.results.map(u =>
      c.env.DB.prepare(
        'INSERT INTO notifications (user_id, type, title, body, created_by) VALUES (?, ?, ?, ?, ?)'
      ).bind(u.id, type || 'normal', title, body, user.id).run()
    ))

    // プッシュ通知は非同期で送信（レスポンスを待たない）
    const pushLen = pushUsers.results.length
    Promise.allSettled(pushUsers.results.map(pu => pushToSubs(pu, payload))).catch(() => {})

    return c.json({ success: true, sent: allUsers.results.length, pushSent: pushLen })
  } catch (e: any) {
    return c.json({ error: '配信失敗: ' + (e.message || e) }, 500)
  }
})

async function pushToSubs(subRow: any, payload: string) {
  const subs: any[] = []
  try {
    const parsed = JSON.parse(subRow.push_subscription)
    if (Array.isArray(parsed)) subs.push(...parsed)
    else subs.push(parsed)
  } catch { return }
  await Promise.allSettled(subs.map(sub =>
    webpush.sendNotification(sub, payload).catch(() => {})
  ))
}

// プッシュ通知テスト送信
admin.post('/notifications/test', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const subRow = await c.env.DB.prepare(
    "SELECT push_subscription FROM notification_settings WHERE user_id = ? AND push_subscription IS NOT NULL AND push_subscription != ''"
  ).bind(user.id).first<any>()
  if (!subRow || !subRow.push_subscription) return c.json({ error: '購読データがありません。通知をオンにしてください' })

  const subs: any[] = []
  try {
    const parsed = JSON.parse(subRow.push_subscription)
    if (Array.isArray(parsed)) subs.push(...parsed)
    else subs.push(parsed)
  } catch { return c.json({ error: '購読データが破損しています。設定から通知をオンにし直してください' }) }

  const epSummary = subs.map((s:any,i:number)=>`${i+1}:${(s.endpoint||'').replace(/https:\/\//,'').split('/')[0]}`).join(', ')
  let sent = 0; let errors: string[] = []
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title: 'テスト通知', body: 'プッシュ通知は正常に動作しています', type: 'normal' }))
      sent++
    } catch (e: any) {
      const sc = e.statusCode || (e.errors?.[0]?.statusCode) || null
      const msg = e.message || String(e)
      errors.push(sc ? `[${sc}] ${msg.substring(0,80)}` : msg.substring(0,80))
    }
  }

  if (sent > 0) return c.json({ success: true, message: `${sent}件/${subs.length}のデバイスに送信しました${errors.length ? `（${errors.length}件失敗）` : ''}`, devices: epSummary })
  const allErrors = errors.join(' | ')
  return c.json({ error: 'プッシュ送信失敗: ' + allErrors, endpoint: subs[0]?.endpoint?.replace(/[?&].*$/,'').substring(0,120) || '' })
})

// 自分通知一覧
admin.get('/notifications/self', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const notifs = await c.env.DB.prepare(
    "SELECT * FROM notifications WHERE user_id = ? AND type = 'self' ORDER BY scheduled_at ASC, created_at DESC"
  ).bind(user.id).all<any>()
  return c.json({ notifications: notifs.results })
})

// 自分通知
admin.post('/notifications/self', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { message, scheduled_at } = await c.req.json()
  if (!message) return c.json({ error: 'メッセージが必要です' }, 400)

  await c.env.DB.prepare(
    'INSERT INTO notifications (user_id, type, title, body, scheduled_at, created_by) VALUES (?, "self", ?, ?, ?, ?)'
  ).bind(user.id, message, '', scheduled_at || null, user.id).run()

  // 即時送信かつプッシュ通知が有効ならWeb Pushを送る
  if (!scheduled_at) {
    const subRow = await c.env.DB.prepare(
      "SELECT push_subscription FROM notification_settings WHERE user_id = ? AND push_enabled = 1 AND push_subscription IS NOT NULL AND push_subscription != ''"
    ).bind(user.id).first<any>()
    if (subRow) await pushToSubs(subRow, JSON.stringify({ title: message, body: '', type: 'self' })).catch(() => {})
  }

  return c.json({ success: true })
})

// プロフィール更新許可
admin.post('/users/:id/allow-profile-edit', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const targetId = parseInt(c.req.param('id'))
  const { expires_at } = await c.req.json()

  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO profile_edit_permissions (user_id, granted_by, expires_at) VALUES (?, ?, ?)'
  ).bind(targetId, user.id, expires_at || null).run()

  return c.json({ success: true })
})

// プロフィール更新許可一覧
admin.get('/profile-edit-permissions', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const perms = await c.env.DB.prepare(`
    SELECT pep.*, u.name as user_name, u.username, g.name as granted_by_name
    FROM profile_edit_permissions pep
    JOIN users u ON pep.user_id = u.id
    JOIN users g ON pep.granted_by = g.id
    ORDER BY pep.created_at DESC
  `).all<any>()

  return c.json({ permissions: perms.results })
})

// 自分のプロフィール更新
admin.put('/profile', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { name, bio, avatar_url, password, club, committee, class_num, number, grade, username, login_id } = body

  const roles = await getUserRoles(c.env.DB, user.id)
  const sensitiveFields = [club, committee, class_num, number, grade]
  const hasSensitive = sensitiveFields.some(f => f !== undefined)

  if (hasSensitive) {
    if (!isStaff(roles)) {
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
  if (username !== undefined) { fields.push('username = ?'); params.push(username) }
  if (login_id !== undefined) { fields.push('login_id = ?'); params.push(login_id) }

  if (password) {
    const hash = await hashPassword(password)
    fields.push('password_hash = ?')
    params.push(hash)
  }

  params.push(user.id)
  await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run()

  const updated = await c.env.DB.prepare(
    'SELECT id, username, login_id, role, name, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, avatar_url, bio FROM users WHERE id = ?'
  ).bind(user.id).first()

  return c.json({ success: true, user: updated })
})

// 教員一覧
admin.get('/teachers', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const teachers = await c.env.DB.prepare(
    "SELECT id, name, subject, is_homeroom, homeroom_class FROM users WHERE id IN (SELECT user_id FROM user_roles WHERE role IN ('teacher', 'admin')) ORDER BY name"
  ).all<any>()

  return c.json({ teachers: teachers.results })
})

// 複数ロール一覧
admin.get('/roles', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const allRoles = await c.env.DB.prepare(`
    SELECT ur.user_id, ur.role, u.name, u.username
    FROM user_roles ur JOIN users u ON ur.user_id = u.id
    ORDER BY u.name, ur.role
  `).all<any>()

  return c.json({ roles: allRoles.results })
})

// 管理設定取得
admin.get('/settings', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  // テーブルがなければ作成
  await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run()
  const defaults: Record<string, string> = { teacher_can_users: 'false', teacher_can_posts: 'true', teacher_can_bulk: 'false', notif_self_default: 'true', allow_changes_until: '' }
  for (const [k, v] of Object.entries(defaults)) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)').bind(k, v).run()
  }

  const settings = await c.env.DB.prepare('SELECT key, value FROM admin_settings').all<any>()
  const result: Record<string, string> = {}
  for (const s of settings.results || []) {
    result[s.key] = s.value
  }
  return c.json({ settings: result })
})

// 管理設定更新
admin.put('/settings', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isAdmin(roles)) return c.json({ error: 'Forbidden' }, 403)
  const { settings } = await c.req.json()
  if (!settings || typeof settings !== 'object') return c.json({ error: 'Invalid' }, 400)

  for (const [key, value] of Object.entries(settings)) {
    await c.env.DB.prepare(
      'INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).bind(key, String(value)).run()
  }
  return c.json({ success: true })
})

// プロフィール変更リクエスト一覧
admin.get('/profile-changes', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS profile_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT, new_value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by INTEGER, reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run()

  const pending = await c.env.DB.prepare(
    `SELECT p.*, u.name as user_name, u.grade, u.class_num, u.number
     FROM profile_change_requests p JOIN users u ON p.user_id = u.id
     WHERE p.status = 'pending' ORDER BY p.created_at DESC`
  ).all<any>()
  return c.json({ requests: pending.results })
})

// プロフィール変更リクエスト一括承認
admin.post('/profile-changes/bulk-approve', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.json().catch(() => ({}))
  let query = "SELECT * FROM profile_change_requests WHERE status = 'pending'"
  const params: any[] = []
  if (body.user_id) { query += ' AND user_id = ?'; params.push(body.user_id) }

  const pending = await c.env.DB.prepare(query).bind(...params).all<any>()

  for (const req of pending.results || []) {
    await c.env.DB.prepare(`UPDATE users SET ${req.field_name} = ? WHERE id = ?`).bind(req.new_value, req.user_id).run()
    await c.env.DB.prepare(
      'UPDATE profile_change_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime("now") WHERE id = ?'
    ).bind('approved', user.id, req.id).run()
    const fieldLabels: Record<string, string> = { name: '名前', grade: '学年', class_num: 'クラス', number: '番号', club: '部活動', committee: '委員会' }
    await c.env.DB.prepare(
      "INSERT INTO notifications (user_id, type, message, icon) VALUES (?, 'profile_approved', ?, 'fa-check-circle')"
    ).bind(req.user_id, `${fieldLabels[req.field_name] || req.field_name}の変更が承認されました`).run()
  }
  return c.json({ success: true, count: pending.results?.length || 0 })
})

// プロフィール変更リクエスト一括却下
admin.post('/profile-changes/bulk-reject', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.json().catch(() => ({}))
  let query = "UPDATE profile_change_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now') WHERE status = 'pending'"
  const params: any[] = [user.id]
  if (body.user_id) { query += ' AND user_id = ?'; params.push(body.user_id) }

  const result = await c.env.DB.prepare(query).bind(...params).run()
  return c.json({ success: true, count: result.meta?.changes || 0 })
})

// プロフィール変更リクエスト承認
admin.post('/profile-changes/:id/approve', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)
  const id = parseInt(c.req.param('id'))

  const req = await c.env.DB.prepare("SELECT * FROM profile_change_requests WHERE id = ? AND status = 'pending'").bind(id).first<any>()
  if (!req) return c.json({ error: 'Not found or already processed' }, 404)

  await c.env.DB.prepare(`UPDATE users SET ${req.field_name} = ? WHERE id = ?`).bind(req.new_value, req.user_id).run()
  await c.env.DB.prepare(
    'UPDATE profile_change_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime("now") WHERE id = ?'
  ).bind('approved', user.id, id).run()

  const fieldLabels: Record<string, string> = { name: '名前', grade: '学年', class_num: 'クラス', number: '番号', club: '部活動', committee: '委員会' }
  await c.env.DB.prepare(
    "INSERT INTO notifications (user_id, type, message, icon) VALUES (?, 'profile_approved', ?, 'fa-check-circle')"
  ).bind(req.user_id, `${fieldLabels[req.field_name] || req.field_name}の変更が承認されました`).run()

  return c.json({ success: true })
})

// プロフィール変更リクエスト却下
admin.post('/profile-changes/:id/reject', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isStaff(roles)) return c.json({ error: 'Forbidden' }, 403)
  const id = parseInt(c.req.param('id'))

  await c.env.DB.prepare(
    "UPDATE profile_change_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'pending'"
  ).bind(user.id, id).run()

  return c.json({ success: true })
})

export default admin
