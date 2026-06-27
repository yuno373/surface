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
  return computed === hash
}

function generateSessionId(): string { return crypto.randomUUID() }

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

function trackFailedLogin(map: Map<string, { count: number; lockedUntil: number }>, key: string) {
  const entry = map.get(key) || { count: 0, lockedUntil: 0 }
  entry.count++
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000
    entry.count = 0
  }
  map.set(key, entry)
}

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
  )`).run().catch(() => {})
  await db.prepare("ALTER TABLE users ADD COLUMN homeroom_year INTEGER DEFAULT NULL").run().catch(() => {})
  await db.prepare("ALTER TABLE users ADD COLUMN roles_text TEXT DEFAULT NULL").run().catch(() => {})
  await db.prepare("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1").run().catch(() => {})
  await db.prepare("ALTER TABLE notification_settings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP").run().catch(() => {})
}

auth.post('/login', async (c) => {
  const { username, password } = await c.req.json()
  if (!username || !password) {
    return c.json({ error: 'ユーザー名とパスワードが必要です' }, 400)
  }

  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const attemptKey = `${ip}:${username}`
  const now = Date.now()
  const attempt = loginAttempts.get(attemptKey)
  if (attempt && attempt.lockedUntil > now) {
    const remaining = Math.ceil((attempt.lockedUntil - now) / 60000)
    return c.json({ error: `ログインがロックされました。${remaining}分後にお試しください` }, 429)
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE username = ? OR name = ? OR login_id = ?'
  ).bind(username, username, username).first<any>()

  if (!user) {
    trackFailedLogin(loginAttempts, attemptKey)
    return c.json({ error: 'ユーザーが見つかりません' }, 401)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    trackFailedLogin(loginAttempts, attemptKey)
    return c.json({ error: 'パスワードが違います' }, 401)
  }

  if (user.is_active === 0) return c.json({ error: 'このアカウントは停止されています' }, 403)

  loginAttempts.delete(attemptKey)

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
  try { await ensureTable(c.env.DB) } catch {}
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)
  const user = await c.env.DB.prepare(
    'SELECT id, username, login_id, role, name, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, homeroom_year, avatar_url, bio, first_login FROM users WHERE id = ?'
  ).bind(session.user_id).first<any>()
  if (!user) return c.json({ error: 'User not found' }, 404)
  const enriched = await enrichUser(c.env.DB, user)
  return c.json({ user: enriched })
})

// 自分の変更リクエスト状況
auth.get('/profile/changes', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)
  const requests = await c.env.DB.prepare(
    "SELECT field_name, old_value, new_value, status, reviewed_at, created_at FROM profile_change_requests WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(session.user_id).all<any>()
  return c.json({ requests: requests.results || [] })
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

  // 生徒の処理
  await ensureTable(c.env.DB)
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<any>()
  if (!user) return c.json({ error: 'User not found' }, 404)

  // 直接編集期間チェック（期間内は承認不要で直接更新）
  const deadlineSetting = await c.env.DB.prepare("SELECT value FROM admin_settings WHERE key = 'allow_changes_until'").first<any>()
  let directEdit = false
  if (deadlineSetting?.value) {
    const deadline = new Date(deadlineSetting.value)
    directEdit = Date.now() <= deadline.getTime()
  }
  if (directEdit) {
    const editable = ['name', 'grade', 'class_num', 'number', 'club', 'committee'] as const
    const updates: string[] = []; const params: any[] = []
    for (const field of editable) {
      if (body[field] !== undefined && String(body[field]) !== String(user[field] || '')) {
        updates.push(`${field} = ?`); params.push(body[field])
      }
    }
    if (updates.length > 0) {
      params.push(session.user_id)
      await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()
    }
    // bioとavatar_urlも直接更新
    if (body.bio !== undefined) await c.env.DB.prepare('UPDATE users SET bio = ? WHERE id = ?').bind(body.bio, session.user_id).run()
    if (body.avatar_url !== undefined) await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(body.avatar_url, session.user_id).run()
    return c.json({ success: true, direct: true })
  }

  // 期間外は承認リクエスト（常時送信可）
  const needApprovalFields = ['name', 'grade', 'class_num', 'number', 'club', 'committee'] as const
  let hasPending = false
  for (const field of needApprovalFields) {
    if (body[field] !== undefined && String(body[field]) !== String(user[field] || '')) {
      const existing = await c.env.DB.prepare(
        "SELECT id FROM profile_change_requests WHERE user_id = ? AND field_name = ? AND status = 'pending'"
      ).bind(session.user_id, field).first()
      if (existing) continue
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
  try { await ensureTable(c.env.DB) } catch {}
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)

  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()

  if (!session) return c.json({ error: 'Session expired' }, 401)

  const user = await c.env.DB.prepare(
    'SELECT id, username, login_id, role, name, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, homeroom_year, avatar_url, bio, first_login, roles_text FROM users WHERE id = ?'
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
  const { name, grade, class_num, number, password, subject, is_homeroom, homeroom_class, homeroom_year } = body

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
  if (homeroom_year !== undefined) { updateFields.push('homeroom_year = ?'); params.push(homeroom_year) }

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
    'SELECT id, username, login_id, role, name, grade, class_num, number, club, committee, subject, is_homeroom, homeroom_class, homeroom_year, avatar_url, bio, first_login FROM users WHERE id = ?'
  ).bind(session.user_id).first<any>()

  const enriched = await enrichUser(c.env.DB, updatedUser)
  return c.json({ success: true, user: enriched })
})

auth.post('/reset-setup', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)
  const user = await c.env.DB.prepare(
    'SELECT role, name FROM users WHERE id = ?'
  ).bind(session.user_id).first<any>()
  if (!user) return c.json({ error: 'User not found' }, 404)
  if (user.role !== 'teacher' && user.role !== 'admin') return c.json({ error: '許可されていません' }, 403)
  await c.env.DB.prepare(
    "UPDATE users SET first_login = 1, name = '', is_homeroom = 0, homeroom_class = NULL, homeroom_year = NULL, subject = NULL, updated_at = datetime('now') WHERE id = ?"
  ).bind(session.user_id).run()
  return c.json({ success: true })
})

auth.all('/debug-env', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)
  const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<any>()
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) return c.json({ error: 'Forbidden' }, 403)

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
  await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS notification_settings (
    user_id INTEGER PRIMARY KEY,
    push_enabled INTEGER DEFAULT 0,
    disaster_enabled INTEGER DEFAULT 0,
    club_post_enabled INTEGER DEFAULT 1,
    committee_post_enabled INTEGER DEFAULT 1,
    school_notice_enabled INTEGER DEFAULT 1,
    message_enabled INTEGER DEFAULT 1,
    push_subscription TEXT
  )`).run().catch(() => {})
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

// 通知一覧
auth.get('/notifications', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)

  const notifs = await c.env.DB.prepare(
    "SELECT * FROM notifications WHERE user_id = ? AND type != 'self' ORDER BY created_at DESC LIMIT 50"
  ).bind(session.user_id).all<any>()
  // 通知タブを開いた瞬間に全て既読
  await c.env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND (type IS NULL OR type != 'self')").bind(session.user_id).run().catch(() => {})
  return c.json({ notifications: notifs.results })
})

// 通知既読
auth.post('/notifications/:id/read', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)

  const id = parseInt(c.req.param('id'))
  const notif = await c.env.DB.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').bind(id, session.user_id).first()
  if (!notif) return c.json({ error: 'Not found' }, 404)

  // notificationsテーブルにis_readカラムがなければ追加
  const colInfo = await c.env.DB.prepare("PRAGMA table_info(notifications)").all<any>()
  if (!colInfo.results.some((r: any) => r.name === 'is_read')) {
    await c.env.DB.prepare("ALTER TABLE notifications ADD COLUMN is_read INTEGER DEFAULT 0").run().catch(() => {})
  }

  await c.env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(id).run()
  return c.json({ success: true, id })
})

// 未読通知数
auth.get('/notifications/unread-count', async (c) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Not authenticated' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return c.json({ error: 'Session expired' }, 401)

  // is_readカラムがない場合は0を返す
  let count = 0
  try {
    const r = await c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0 AND (type IS NULL OR type != 'self')"
    ).bind(session.user_id).first<any>()
    count = r?.cnt || 0
  } catch {
    // is_readカラムがない場合
  }
  return c.json({ count })
})

export default auth
