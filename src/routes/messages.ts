import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = { DB: any }
const messages = new Hono<{ Bindings: Bindings }>()
let _tablesEnsured = false

async function ensureTables(db: any) {
  if (_tablesEnsured) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS message_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT NOT NULL DEFAULT 'direct',
    created_by INTEGER NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS thread_members (
    thread_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (thread_id, user_id)
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT DEFAULT '',
    file_url TEXT,
    file_type TEXT,
    is_deleted INTEGER DEFAULT 0,
    edited_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS message_reads (
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id)
  )`).run()
  // 既存テーブルに不足カラムを追加（マイグレーション未実行対策）
  const alters = [
    "ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE messages ADD COLUMN edited_at DATETIME",
    "ALTER TABLE message_threads ADD COLUMN is_pinned INTEGER DEFAULT 0",
    "ALTER TABLE message_threads ADD COLUMN is_archived INTEGER DEFAULT 0",
    "ALTER TABLE message_threads ADD COLUMN deleted_at DATETIME",
  ]
  for (const sql of alters) {
    try { await db.prepare(sql).run() } catch {}
  }
  _tablesEnsured = true
}

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

// スレッド一覧
messages.get('/threads', async (c) => {
  await ensureTables(c.env.DB)
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const threadType = c.req.query('type') || 'all'
  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))

  let query = `
    SELECT mt.*, tm.user_id,
      (SELECT content FROM messages WHERE thread_id = mt.id AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE thread_id = mt.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM messages m WHERE m.thread_id = mt.id AND m.is_deleted = 0 AND m.id NOT IN (SELECT message_id FROM message_reads WHERE user_id = ?)) as unread_count
    FROM message_threads mt
    JOIN thread_members tm ON mt.id = tm.thread_id
    WHERE tm.user_id = ? AND mt.deleted_at IS NULL
  `
  // captain_groupは部長チャット専用テーブルに分離
  let params: any[] = [user.id, user.id]

  if (threadType === 'captain') {
    query += " AND mt.type = 'captain_group'"
  } else if (threadType === 'direct') {
    query += " AND mt.type = 'direct'"
  } else if (threadType === 'group') {
    query += " AND mt.type = 'group'"
  } else {
    // 'all'の場合はcaptain_groupを除外（別タブで表示）
    query += " AND mt.type != 'captain_group'"
  }

  query += ' ORDER BY mt.is_pinned DESC, last_message_at DESC'

  const threads = await c.env.DB.prepare(query).bind(...params).all<any>()

  const enriched = await Promise.all(threads.results.map(async (t: any) => {
    const members = await c.env.DB.prepare(
      'SELECT u.id, u.name, u.role FROM thread_members tm JOIN users u ON tm.user_id = u.id WHERE tm.thread_id = ?'
    ).bind(t.id).all<any>()
    return { ...t, members: members.results }
  }))

  return c.json({ threads: enriched })
})

// キャプテンスレッド（部長・委員長チャット）専用
messages.get('/captain-threads', async (c) => {
  await ensureTables(c.env.DB)
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const roles = await getUserRoles(c.env.DB, user.id)
  const canAccess = roles.some((r: string) => ['admin', 'teacher', 'captain', 'chairman', 'vice_captain', 'vice_chairman', 'student_council'].includes(r))
  if (!canAccess) return c.json({ error: 'Forbidden' }, 403)

  let query = `
    SELECT mt.*, tm.user_id,
      (SELECT content FROM messages WHERE thread_id = mt.id AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE thread_id = mt.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM messages m WHERE m.thread_id = mt.id AND m.is_deleted = 0 AND m.id NOT IN (SELECT message_id FROM message_reads WHERE user_id = ?)) as unread_count
    FROM message_threads mt
    JOIN thread_members tm ON mt.id = tm.thread_id
    WHERE tm.user_id = ? AND mt.deleted_at IS NULL AND mt.type = 'captain_group'
    ORDER BY mt.is_pinned DESC, last_message_at DESC
  `

  const threads = await c.env.DB.prepare(query).bind(user.id, user.id).all<any>()
  const enriched = await Promise.all(threads.results.map(async (t: any) => {
    const members = await c.env.DB.prepare(
      'SELECT u.id, u.name, u.role FROM thread_members tm JOIN users u ON tm.user_id = u.id WHERE tm.thread_id = ?'
    ).bind(t.id).all<any>()
    return { ...t, members: members.results }
  }))

  return c.json({ threads: enriched })
})

// スレッド作成
messages.post('/threads', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { name, type, member_ids } = await c.req.json()
  const roles = await getUserRoles(c.env.DB, user.id)

  // 生徒同士DM禁止
  if (type === 'direct' && !roles.some((r: string) => ['admin', 'teacher'].includes(r))) {
    const targetUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(member_ids[0]).first<any>()
    if (targetUser) {
      const targetRoles = await getUserRoles(c.env.DB, targetUser.id)
      const isTargetStudent = !targetRoles.some((r: string) => ['admin', 'teacher'].includes(r))
      if (isTargetStudent) {
        return c.json({ error: '生徒同士のメッセージは送れません' }, 403)
      }
    }
  }

  if (type === 'captain_group') {
    const canCreate = roles.some((r: string) => ['admin', 'teacher', 'captain', 'chairman', 'student_council'].includes(r))
    if (!canCreate) return c.json({ error: '権限がありません' }, 403)
  }

  if (type === 'group') {
    const memberUsers = await c.env.DB.prepare(
      `SELECT id FROM users WHERE id IN (${member_ids.map(() => '?').join(',')})`
    ).bind(...member_ids).all<any>()
    const hasStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))
    if (!hasStaff) {
      return c.json({ error: 'グループには先生が必要です' }, 403)
    }
  }

  // 既存のDMスレッドをチェック（同じ相手との重複防止）
  if (type === 'direct' && member_ids.length === 1) {
    const existingThreads = await c.env.DB.prepare(`
      SELECT mt.id FROM message_threads mt
      WHERE mt.type = 'direct' AND mt.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM thread_members WHERE thread_id = mt.id AND user_id = ?)
      AND EXISTS (SELECT 1 FROM thread_members WHERE thread_id = mt.id AND user_id = ?)
    `).bind(user.id, member_ids[0]).all<any>()

    if (existingThreads.results.length > 0) {
      return c.json({ success: true, thread_id: existingThreads.results[0].id, existing: true })
    }
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO message_threads (name, type, created_by) VALUES (?, ?, ?)'
  ).bind(name || null, type, user.id).run()

  const threadId = result.meta.last_row_id

  const allMembers = [user.id, ...(member_ids || []).filter((id: number) => id !== user.id)]
  for (const memberId of allMembers) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO thread_members (thread_id, user_id) VALUES (?, ?)'
    ).bind(threadId, memberId).run()
  }

  return c.json({ success: true, thread_id: threadId, existing: false })
})

// スレッド詳細（メンバー含む）
messages.get('/threads/:id', async (c) => {
  await ensureTables(c.env.DB)
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const threadId = parseInt(c.req.param('id'))

  const thread = await c.env.DB.prepare(
    'SELECT mt.*, tm.user_id FROM message_threads mt JOIN thread_members tm ON mt.id = tm.thread_id WHERE mt.id = ? AND tm.user_id = ? AND mt.deleted_at IS NULL'
  ).bind(threadId, user.id).first<any>()
  if (!thread) return c.json({ error: 'Not found' }, 404)

  const members = await c.env.DB.prepare(
    'SELECT u.id, u.name, u.role FROM users u JOIN thread_members tm ON u.id = tm.user_id WHERE tm.thread_id = ?'
  ).bind(threadId).all<any>()

  return c.json({ thread: { ...thread, members: members.results } })
})

// スレッドピン留め
messages.post('/threads/:id/pin', async (c) => {
  await ensureTables(c.env.DB)
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const threadId = parseInt(c.req.param('id'))

  const member = await c.env.DB.prepare(
    'SELECT * FROM thread_members WHERE thread_id = ? AND user_id = ?'
  ).bind(threadId, user.id).first()
  if (!member) return c.json({ error: 'Member not found' }, 403)

  const thread = await c.env.DB.prepare('SELECT is_pinned FROM message_threads WHERE id = ?').bind(threadId).first<any>()
  const newPinned = thread?.is_pinned ? 0 : 1
  await c.env.DB.prepare('UPDATE message_threads SET is_pinned = ? WHERE id = ?').bind(newPinned, threadId).run()

  return c.json({ success: true, is_pinned: newPinned })
})

// スレッド削除（アーカイブ）
messages.delete('/threads/:id', async (c) => {
  await ensureTables(c.env.DB)
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const threadId = parseInt(c.req.param('id'))

  const member = await c.env.DB.prepare(
    'SELECT * FROM thread_members WHERE thread_id = ? AND user_id = ?'
  ).bind(threadId, user.id).first()
  if (!member) return c.json({ error: 'Member not found' }, 403)

  await c.env.DB.prepare(
    "UPDATE message_threads SET deleted_at = datetime('now') WHERE id = ?"
  ).bind(threadId).run()

  return c.json({ success: true })
})

// メッセージ一覧
messages.get('/threads/:threadId/messages', async (c) => {
  await ensureTables(c.env.DB)
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const threadId = parseInt(c.req.param('threadId'))

  const member = await c.env.DB.prepare(
    'SELECT * FROM thread_members WHERE thread_id = ? AND user_id = ?'
  ).bind(threadId, user.id).first()
  if (!member) return c.json({ error: 'Not a member' }, 403)

  const msgList = await c.env.DB.prepare(`
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE m.thread_id = ? AND m.is_deleted = 0
    ORDER BY m.created_at ASC
    LIMIT 200
  `).bind(threadId).all<any>()

  // 既読記録
  for (const msg of msgList.results) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)'
    ).bind(msg.id, user.id).run()
  }

  // 各メッセージの既読者を取得
  const msgIds = msgList.results.map((m: any) => m.id)
  let readMap: Record<number, any[]> = {}
  if (msgIds.length > 0) {
    const placeholders = msgIds.map(() => '?').join(',')
    const reads = await c.env.DB.prepare(
      `SELECT mr.message_id, u.id, u.name FROM message_reads mr JOIN users u ON mr.user_id = u.id WHERE mr.message_id IN (${placeholders}) ORDER BY mr.read_at ASC`
    ).bind(...msgIds).all<any>()
    reads.results.forEach((r: any) => {
      if (!readMap[r.message_id]) readMap[r.message_id] = []
      readMap[r.message_id].push({ id: r.id, name: r.name })
    })
  }

  const enriched = msgList.results.map((m: any) => ({
    ...m,
    readers: readMap[m.id] || []
  }))

  return c.json({ messages: enriched })
})

// メッセージ送信
messages.post('/threads/:threadId/messages', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const threadId = parseInt(c.req.param('threadId'))

  const member = await c.env.DB.prepare(
    'SELECT * FROM thread_members WHERE thread_id = ? AND user_id = ?'
  ).bind(threadId, user.id).first()
  if (!member) return c.json({ error: 'Not a member' }, 403)

  const { content, file_url, file_type } = await c.req.json()
  if (!content && !file_url) return c.json({ error: '内容が必要です' }, 400)

  const result = await c.env.DB.prepare(
    'INSERT INTO messages (thread_id, sender_id, content, file_url, file_type) VALUES (?, ?, ?, ?, ?)'
  ).bind(threadId, user.id, content || '', file_url || null, file_type || null).run()

  // DB通知レコードを作成（非同期・fire-and-forget）
  try {
    const thread = await c.env.DB.prepare('SELECT * FROM message_threads WHERE id = ?').bind(threadId).first<any>()
    const members = await c.env.DB.prepare(
      'SELECT user_id FROM thread_members WHERE thread_id = ? AND user_id != ?'
    ).bind(threadId, user.id).all<any>()
    if (members.results.length > 0) {
      const preview = (content || file_url || '').substring(0, 80)
      const notifTitle = (thread?.name || 'メッセージ') + ': ' + user.name
      Promise.all(members.results.map(m =>
        c.env.DB.prepare('INSERT INTO notifications (user_id, type, title, body, created_by) VALUES (?, ?, ?, ?, ?)')
          .bind(m.user_id, 'message:' + threadId, notifTitle, preview, user.id).run()
      )).catch(() => {})
    }
  } catch {}

  return c.json({ success: true, message_id: result.meta.last_row_id })
})

// メッセージ取消（削除）
messages.delete('/threads/:threadId/messages/:messageId', async (c) => {
  await ensureTables(c.env.DB)
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const threadId = parseInt(c.req.param('threadId'))
  const messageId = parseInt(c.req.param('messageId'))

  const msg = await c.env.DB.prepare('SELECT * FROM messages WHERE id = ? AND thread_id = ?')
    .bind(messageId, threadId).first<any>()
  if (!msg) return c.json({ error: 'Not found' }, 404)

  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))

  if (msg.sender_id !== user.id && !isStaff) {
    return c.json({ error: '権限がありません' }, 403)
  }

  // 送信から一定時間経過してたら管理者のみ取消可能（24時間）
  const elapsed = Date.now() - new Date(msg.created_at).getTime()
  if (msg.sender_id === user.id && elapsed > 24 * 60 * 60 * 1000 && !isStaff) {
    return c.json({ error: '送信から24時間以上経過したメッセージは取消せません' }, 403)
  }

  await c.env.DB.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').bind(messageId).run()
  return c.json({ success: true })
})

// メンバー管理
messages.post('/threads/:threadId/members', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))
  if (!user || !isStaff) return c.json({ error: 'Forbidden' }, 403)
  const threadId = parseInt(c.req.param('threadId'))

  const { user_id, action } = await c.req.json()
  if (action === 'add') {
    await c.env.DB.prepare('INSERT OR IGNORE INTO thread_members (thread_id, user_id) VALUES (?, ?)')
      .bind(threadId, user_id).run()
  } else if (action === 'remove') {
    await c.env.DB.prepare('DELETE FROM thread_members WHERE thread_id = ? AND user_id = ?')
      .bind(threadId, user_id).run()
  }
  return c.json({ success: true })
})

// 未読メッセージ件数
messages.get('/unread-count', async (c) => {
  await ensureTables(c.env.DB)
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const result = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM thread_members tm
    JOIN message_threads mt ON tm.thread_id = mt.id
    WHERE tm.user_id = ? AND mt.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = mt.id AND m.is_deleted = 0 AND m.id NOT IN (SELECT message_id FROM message_reads WHERE user_id = ?))
  `).bind(user.id, user.id).first<any>()
  return c.json({ count: result?.count || 0 })
})

// ユーザー一覧（メッセージ相手選択用）
messages.get('/users', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))

  let query = 'SELECT id, name, role, grade, class_num, club, committee FROM users WHERE id != ?'
  const params: any[] = [user.id]

  if (!isStaff) {
    query += " AND (role IN ('teacher', 'admin') OR id IN (SELECT user_id FROM user_roles WHERE role IN ('teacher', 'admin')))"
  }

  const users = await c.env.DB.prepare(query).bind(...params).all<any>()
  return c.json({ users: users.results })
})

// メンバー削除（個別）
messages.delete('/threads/:threadId/members/:userId', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))
  if (!user || !isStaff) return c.json({ error: 'Forbidden' }, 403)
  const threadId = parseInt(c.req.param('threadId'))
  const userId = parseInt(c.req.param('userId'))
  await c.env.DB.prepare('DELETE FROM thread_members WHERE thread_id = ? AND user_id = ?')
    .bind(threadId, userId).run()
  return c.json({ success: true })
})

export default messages
