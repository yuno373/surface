import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = { DB: any }
const questions = new Hono<{ Bindings: Bindings }>()

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

// 質問可能なターゲット一覧
questions.get('/targets', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const targets = await c.env.DB.prepare(`
    SELECT DISTINCT u.id, u.name, ur.role, u.club, u.committee
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    WHERE ur.role IN ('captain', 'chairman', 'vice_captain', 'vice_chairman', 'student_council')
    ORDER BY ur.role, u.name
  `).all<any>()

  return c.json({ targets: targets.results })
})

// 質問一覧（自分が対象のもの）
questions.get('/my', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const myQuestions = await c.env.DB.prepare(`
    SELECT q.*, u.name as asker_name
    FROM questions q
    JOIN users u ON q.asker_id = u.id
    WHERE q.target_id = ? AND (q.expires_at IS NULL OR q.expires_at > datetime("now"))
    ORDER BY q.created_at DESC
  `).bind(user.id).all<any>()

  return c.json({ questions: myQuestions.results })
})

// 自分が送った質問一覧
questions.get('/sent', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const sent = await c.env.DB.prepare(`
    SELECT q.*, u.name as target_name
    FROM questions q
    JOIN users u ON q.target_id = u.id
    WHERE q.asker_id = ? AND (q.expires_at IS NULL OR q.expires_at > datetime("now"))
    ORDER BY q.created_at DESC
  `).bind(user.id).all<any>()

  return c.json({ questions: sent.results })
})

// 全質問履歴（管理者・先生）
questions.get('/history', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !roles.some((r: string) => ['admin', 'teacher'].includes(r))) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const allQ = await c.env.DB.prepare(`
    SELECT q.*, ua.name as asker_name, ut.name as target_name
    FROM questions q
    JOIN users ua ON q.asker_id = ua.id
    JOIN users ut ON q.target_id = ut.id
    ORDER BY q.created_at DESC
    LIMIT 100
  `).all<any>()

  return c.json({ questions: allQ.results })
})

// 質問投稿
questions.post('/', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { target_id, content } = await c.req.json()
  if (!target_id || !content) return c.json({ error: '必要な情報が不足しています' }, 400)

  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(target_id).first()
  if (!target) return c.json({ error: '質問先が見つかりません' }, 404)

  const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO questions (asker_id, target_id, content, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(user.id, target_id, content, expiresAt).run()

  return c.json({ success: true })
})

// 質問に回答
questions.put('/:id/answer', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const qId = parseInt(c.req.param('id'))
  const { answer } = await c.req.json()

  const q = await c.env.DB.prepare('SELECT * FROM questions WHERE id = ?').bind(qId).first<any>()
  if (!q) return c.json({ error: 'Not found' }, 404)

  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))

  if (q.target_id !== user.id && !isStaff) {
    return c.json({ error: '回答権限がありません' }, 403)
  }

  await c.env.DB.prepare(
    'UPDATE questions SET answer = ?, answered_at = datetime("now") WHERE id = ?'
  ).bind(answer, qId).run()

  return c.json({ success: true })
})

// 相談一覧
questions.get('/consultations', async (c) => {
  await ensureConsultTable(c.env.DB)
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))

  let query: string
  let params: any[]

  if (isStaff) {
    query = `SELECT c.*, us.name as student_name FROM consultations c JOIN users us ON c.student_id = us.id WHERE c.teacher_id = ? ORDER BY c.created_at DESC`
    params = [user.id]
  } else {
    query = `SELECT c.*, ut.name as teacher_name FROM consultations c JOIN users ut ON c.teacher_id = ut.id WHERE c.student_id = ? ORDER BY c.created_at DESC`
    params = [user.id]
  }

  const consultations = await c.env.DB.prepare(query).bind(...params).all<any>()
  return c.json({ consultations: consultations.results })
})

// 相談投稿
questions.post('/consultations', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { teacher_id, content } = await c.req.json()
  if (!teacher_id || !content) return c.json({ error: '必要な情報が不足しています' }, 400)

  await c.env.DB.prepare(
    'INSERT INTO consultations (student_id, teacher_id, content) VALUES (?, ?, ?)'
  ).bind(user.id, teacher_id, content).run()

  return c.json({ success: true })
})

// 相談に返答
questions.put('/consultations/:id/reply', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !roles.some((r: string) => ['admin', 'teacher'].includes(r))) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const cId = parseInt(c.req.param('id'))
  const { reply } = await c.req.json()

  await c.env.DB.prepare(
    'UPDATE consultations SET reply = ?, replied_at = datetime("now"), status = "closed" WHERE id = ?'
  ).bind(reply, cId).run()

  return c.json({ success: true })
})

export default questions

async function ensureConsultTable(db: any) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS consultations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    reply TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    replied_at DATETIME
  )`).run()
}
