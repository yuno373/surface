import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = { DB: D1Database }
const messages = new Hono<{ Bindings: Bindings }>()

async function getUser(c: any) {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return null
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return null
  return await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<any>()
}

// スレッド一覧
messages.get('/threads', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const threadType = c.req.query('type') || 'all'
  let query = `
    SELECT mt.*, tm.user_id,
      (SELECT content FROM messages WHERE thread_id = mt.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE thread_id = mt.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM messages m WHERE m.thread_id = mt.id AND m.id NOT IN (SELECT message_id FROM message_reads WHERE user_id = ?)) as unread_count
    FROM message_threads mt
    JOIN thread_members tm ON mt.id = tm.thread_id
    WHERE tm.user_id = ?
  `
  let params: any[] = [user.id, user.id]

  if (threadType === 'captain') {
    query += " AND mt.type = 'captain_group'"
  } else if (threadType === 'direct') {
    query += " AND mt.type = 'direct'"
  } else if (threadType === 'group') {
    query += " AND mt.type = 'group'"
  }

  query += ' ORDER BY last_message_at DESC'

  const threads = await c.env.DB.prepare(query).bind(...params).all<any>()

  // スレッドのメンバー名を取得
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

  // 生徒は生徒にDM不可
  if (type === 'direct' && user.role === 'student') {
    const targetUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?')
      .bind(member_ids[0]).first<any>()
    if (targetUser && targetUser.role === 'student') {
      return c.json({ error: '生徒同士のメッセージは送れません' }, 403)
    }
  }

  // 部長チャットは先生・管理者・部長・委員長のみ作成可能
  if (type === 'captain_group') {
    if (!['admin', 'teacher', 'captain', 'chairman'].includes(user.role)) {
      return c.json({ error: '権限がありません' }, 403)
    }
  }

  // グループは先生が必須
  if (type === 'group') {
    const memberUsers = await c.env.DB.prepare(
      `SELECT role FROM users WHERE id IN (${member_ids.map(() => '?').join(',')})`
    ).bind(...member_ids).all<any>()
    const hasTeacher = memberUsers.results.some((u: any) => ['admin', 'teacher'].includes(u.role))
    if (!hasTeacher && !['admin', 'teacher'].includes(user.role)) {
      return c.json({ error: 'グループには先生が必要です' }, 403)
    }
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO message_threads (name, type, created_by) VALUES (?, ?, ?)'
  ).bind(name || null, type, user.id).run()

  const threadId = result.meta.last_row_id

  // 作成者を追加
  const allMembers = [user.id, ...(member_ids || []).filter((id: number) => id !== user.id)]
  for (const memberId of allMembers) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO thread_members (thread_id, user_id) VALUES (?, ?)'
    ).bind(threadId, memberId).run()
  }

  return c.json({ success: true, thread_id: threadId })
})

// メッセージ一覧取得
messages.get('/threads/:threadId/messages', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const threadId = parseInt(c.req.param('threadId'))

  // メンバー確認
  const member = await c.env.DB.prepare(
    'SELECT * FROM thread_members WHERE thread_id = ? AND user_id = ?'
  ).bind(threadId, user.id).first()
  if (!member) return c.json({ error: 'このスレッドのメンバーではありません' }, 403)

  const msgList = await c.env.DB.prepare(`
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE m.thread_id = ?
    ORDER BY m.created_at ASC
    LIMIT 100
  `).bind(threadId).all<any>()

  // 既読にする
  for (const msg of msgList.results) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)'
    ).bind(msg.id, user.id).run()
  }

  return c.json({ messages: msgList.results })
})

// メッセージ送信
messages.post('/threads/:threadId/messages', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const threadId = parseInt(c.req.param('threadId'))

  const member = await c.env.DB.prepare(
    'SELECT * FROM thread_members WHERE thread_id = ? AND user_id = ?'
  ).bind(threadId, user.id).first()
  if (!member) return c.json({ error: 'このスレッドのメンバーではありません' }, 403)

  const thread = await c.env.DB.prepare('SELECT * FROM message_threads WHERE id = ?').bind(threadId).first<any>()

  // 生徒同士チェック
  if (thread && thread.type === 'direct' && user.role === 'student') {
    const members = await c.env.DB.prepare(
      'SELECT u.role FROM thread_members tm JOIN users u ON tm.user_id = u.id WHERE tm.thread_id = ? AND tm.user_id != ?'
    ).bind(threadId, user.id).all<any>()
    const allStudents = members.results.every((m: any) => m.role === 'student')
    if (allStudents) return c.json({ error: '生徒同士のメッセージは送れません' }, 403)
  }

  const { content, file_url, file_type } = await c.req.json()
  if (!content) return c.json({ error: '内容が必要です' }, 400)

  const result = await c.env.DB.prepare(
    'INSERT INTO messages (thread_id, sender_id, content, file_url, file_type) VALUES (?, ?, ?, ?, ?)'
  ).bind(threadId, user.id, content, file_url || null, file_type || null).run()

  return c.json({ success: true, message_id: result.meta.last_row_id })
})

// 部長チャットメンバー追加/削除（管理者・先生）
messages.post('/threads/:threadId/members', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)
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

// ユーザー一覧（メッセージ相手選択用）
messages.get('/users', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  let query = 'SELECT id, name, role, grade, class_num, club, committee FROM users WHERE id != ?'
  const params: any[] = [user.id]

  // 生徒は先生・管理者のみ
  if (user.role === 'student') {
    query += " AND role IN ('teacher', 'admin')"
  }

  const users = await c.env.DB.prepare(query).bind(...params).all<any>()
  return c.json({ users: users.results })
})

export default messages
