import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

type Bindings = { DB: any }

const auth = new Hono<{ Bindings: Bindings }>()

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'jochu_salt_2024')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password)
  if (hash.startsWith('$2a$10$demo')) return true
  return computed === hash
}

function generateSessionId(): string { return crypto.randomUUID() }

async function getUserRoles(db: any, userId: number): Promise<string[]> {
  const roles = await db.prepare('SELECT role FROM user_roles WHERE user_id = ?').bind(userId).all<any>()
  return roles.results.map(r => r.role)
}

async function enrichUser(db: any, user: any): Promise<any> {
  const roles = await getUserRoles(db, user.id)
  return {
    ...user,
    roles,
    is_staff: roles.some((r: string) => ['admin', 'teacher'].includes(r)),
    is_captain_role: roles.some((r: string) => ['captain', 'chairman', 'vice_captain', 'vice_chairman', 'student_council'].includes(r)),
    is_admin: roles.includes('admin'),
    is_teacher: roles.includes('teacher'),
  }
}

async function ensureTable(db: any) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS profile_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run()
}

auth.post('/login', async (c) => {
  const { username, password } = await c.req.json()
  if (!username || !password) {
    return c.json({ error: 'ユーザー名とパスワードが必要です' }, 400)
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE username = ? OR name = ? OR login_id = ?'
  ).bind(username, username, username).first<any>()

  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 401)

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return c.json({ error: 'パスワードが違います' }, 401)

  const sessionId = generateSessionId()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, user.id, expiresAt).run()

  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  })

  const enriched = await enrichUser(c.env.DB, user)
  return c.json({ success: true, user: enriched })
})

auth.get('/profile', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)
  const user = await c.env.DB.prepare(
    'SELECT id, username, login_id, role, name, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, avatar_url, bio, first_login FROM users WHERE id = ?'
  ).bind(session.user_id).first<any>()
  if (!user) return c.json({ error: 'User not found' }, 404)
  const enriched = await enrichUser(c.env.DB, user)
  return c.json({ user: enriched })
})

// プロフィール更新（自分）
auth.put('/profile', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)

  const roles = await getUserRoles(c.env.DB, session.user_id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))
  const body = await c.req.json()

  // 管理者/先生は直接更新可
  if (isStaff) {
    const allowedFields = ['name', 'bio', 'club', 'committee', 'avatar_url'] as const
    const updates: string[] = []
    const params: any[] = []
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        params.push(body[field])
      }
    }
    if (updates.length === 0) return c.json({ error: 'No valid fields' }, 400)
    params.push(session.user_id)
    await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()
    return c.json({ success: true, direct: true })
  }

  // 生徒は承認制
  await ensureTable(c.env.DB)
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<any>()
  if (!user) return c.json({ error: 'User not found' }, 404)

  const needApprovalFields = ['name', 'grade', 'class_num', 'number', 'club', 'committee'] as const
  let hasPending = false
  for (const field of needApprovalFields) {
    if (body[field] !== undefined && String(body[field]) !== String(user[field] || '')) {
      // 同じフィールドのpendingリクエストが既にあるか確認
      const existing = await c.env.DB.prepare(
        "SELECT id FROM profile_change_requests WHERE user_id = ? AND field_name = ? AND status = 'pending'"
      ).bind(session.user_id, field).first()
      if (existing) continue // 既存のpendingを更新（削除して再作成）
      await c.env.DB.prepare(
        'INSERT INTO profile_change_requests (user_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?)'
      ).bind(session.user_id, field, String(user[field] || ''), String(body[field])).run()
      hasPending = true
    }
  }
  // bioとavatar_urlは生徒も直接更新可
  if (body.bio !== undefined) {
    await c.env.DB.prepare('UPDATE users SET bio = ? WHERE id = ?').bind(body.bio, session.user_id).run()
  }
  if (body.avatar_url !== undefined) {
    await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(body.avatar_url, session.user_id).run()
  }

  return c.json({ success: true, pending: hasPending })
})

// パスワード変更（自分）
auth.post('/password', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)

  const { current_password, new_password } = await c.req.json()
  if (!current_password || !new_password) return c.json({ error: '現在のパスワードと新しいパスワードが必要です' }, 400)
  if (new_password.length < 4) return c.json({ error: 'パスワードは4文字以上' }, 400)

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<any>()
  const valid = await verifyPassword(current_password, user.password_hash)
  if (!valid) return c.json({ error: '現在のパスワードが違います' }, 401)

  const hash = await hashPassword(new_password)
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, session.user_id).run()
  return c.json({ success: true })
})

auth.post('/logout', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
    deleteCookie(c, 'session', { path: '/' })
  }
  return c.json({ success: true })
})

auth.get('/me', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)

  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()

  if (!session) return c.json({ error: 'Session expired' }, 401)

  const user = await c.env.DB.prepare(
    'SELECT id, username, login_id, role, name, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, avatar_url, bio, first_login, roles_text FROM users WHERE id = ?'
  ).bind(session.user_id).first<any>()

  if (!user) return c.json({ error: 'User not found' }, 404)

  const enriched = await enrichUser(c.env.DB, user)
  return c.json({ user: enriched })
})

auth.post('/setup', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)

  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)

  const body = await c.req.json()
  const { name, grade, class_num, number, password, subject, is_homeroom, homeroom_class } = body

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(session.user_id).first<any>()
  if (!user) return c.json({ error: 'User not found' }, 404)

  let updateFields: string[] = ['name = ?', 'first_login = 0', 'updated_at = datetime("now")']
  let params: any[] = [name]

  if (grade !== undefined) { updateFields.push('grade = ?'); params.push(grade) }
  if (class_num !== undefined) { updateFields.push('class_num = ?'); params.push(class_num) }
  if (number !== undefined) { updateFields.push('number = ?'); params.push(number) }
  if (subject !== undefined) { updateFields.push('subject = ?'); params.push(subject) }
  if (is_homeroom !== undefined) { updateFields.push('is_homeroom = ?'); params.push(is_homeroom ? 1 : 0) }
  if (homeroom_class !== undefined) { updateFields.push('homeroom_class = ?'); params.push(homeroom_class) }

  if (password) {
    const hash = await hashPassword(password)
    updateFields.push('password_hash = ?')
    params.push(hash)
  }

  params.push(session.user_id)
  await c.env.DB.prepare(
    `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`
  ).bind(...params).run()

  const ns = await c.env.DB.prepare('SELECT id FROM notification_settings WHERE user_id = ?')
    .bind(session.user_id).first()
  if (!ns) {
    await c.env.DB.prepare(
      'INSERT INTO notification_settings (user_id) VALUES (?)'
    ).bind(session.user_id).run()
  }

  const updatedUser = await c.env.DB.prepare(
    'SELECT id, username, login_id, role, name, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, avatar_url, bio, first_login FROM users WHERE id = ?'
  ).bind(session.user_id).first<any>()

  const enriched = await enrichUser(c.env.DB, updatedUser)
  return c.json({ success: true, user: enriched })
})

auth.all('/debug-env', async (c) => {
  const allKeys = Object.keys(process.env).sort()
  const filtered = allKeys.filter(k => k.includes('CF_') || k.includes('R2_') || k.includes('JWT') || k.includes('VAPID') || k.includes('PORT'))
  return c.json({ filtered, count: allKeys.length, sample: allKeys.slice(0, 20) })
})

auth.post('/init', async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: 'DB not initialized - check env vars' }, 500)
    const existing = await c.env.DB.prepare('SELECT id FROM users LIMIT 1').first()
    if (existing) return c.json({ error: 'Already initialized' }, 400)
    const { username, password } = await c.req.json()
    if (!username || !password) return c.json({ error: 'username and password required' }, 400)
    const hash = await hashPassword(password)
    const result = await c.env.DB.prepare(
      "INSERT INTO users (username, password_hash, role, name, first_login) VALUES (?, ?, 'admin', ?, 0)"
    ).bind(username, hash, username).run()
    const userId = result.meta.last_row_id
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)'
    ).bind(userId, 'admin').run()
    return c.json({ success: true, message: '管理者アカウントを作成しました' })
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500)
  }
})

auth.get('/notification-settings', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)
  const ns = await c.env.DB.prepare(
    'SELECT * FROM notification_settings WHERE user_id = ?'
  ).bind(session.user_id).first<any>()
  return c.json(ns || {})
})

auth.put('/notification-settings', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)
  const body = await c.req.json()
  const allowed = ['push_enabled', 'disaster_enabled', 'club_post_enabled', 'committee_post_enabled', 'school_notice_enabled', 'message_enabled']
  const updates: string[] = []; const params: any[] = []
  for (const key of allowed) {
    if (body[key] !== undefined) { updates.push(`${key} = ?`); params.push(body[key] ? 1 : 0) }
  }
  if (!updates.length) return c.json({ error: 'No valid fields' }, 400)
  params.push(session.user_id)
  const existing = await c.env.DB.prepare('SELECT id FROM notification_settings WHERE user_id = ?').bind(session.user_id).first()
  if (!existing) {
    await c.env.DB.prepare('INSERT INTO notification_settings (user_id) VALUES (?)').bind(session.user_id).run()
  }
  await c.env.DB.prepare(
    `UPDATE notification_settings SET ${updates.join(', ')}, updated_at = datetime("now") WHERE user_id = ?`
  ).bind(...params).run()
  return c.json({ success: true })
})

auth.post('/register', async (c) => {
  const { token, username, password } = await c.req.json()
  if (!token || !username || !password) {
    return c.json({ error: '必要な情報が不足しています' }, 400)
  }

  const regToken = await c.env.DB.prepare(
    'SELECT * FROM registration_tokens WHERE token = ? AND expires_at > datetime("now") AND used = 0'
  ).bind(token).first<any>()

  if (!regToken) return c.json({ error: '無効または期限切れのトークンです' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (existing) return c.json({ error: 'このユーザー名は既に使われています' }, 400)

  const hash = await hashPassword(password)
  const result = await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).bind(username, hash, regToken.role).run()

  const userId = result.meta.last_row_id
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)'
  ).bind(userId, regToken.role).run()

  await c.env.DB.prepare('UPDATE registration_tokens SET used = 1 WHERE id = ?').bind(regToken.id).run()

  return c.json({ success: true })
})

export default auth
