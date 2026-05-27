import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = { DB: D1Database }
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

// 質問可能なターゲット一覧（部長・委員長・副部長・副委員長）
questions.get('/targets', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const targets = await c.env.DB.prepare(
    "SELECT id, name, role, club, committee FROM users WHERE role IN ('captain', 'chairman', 'vice_captain', 'vice_chairman') ORDER BY role, name"
  ).all<any>()

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

// 全質問履歴（管理者・先生）
questions.get('/history', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

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

  const target = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ? AND role IN ('captain', 'chairman', 'vice_captain', 'vice_chairman')"
  ).bind(target_id).first()
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

  if (q.target_id !== user.id && !['admin', 'teacher'].includes(user.role)) {
    return c.json({ error: '回答権限がありません' }, 403)
  }

  await c.env.DB.prepare(
    'UPDATE questions SET answer = ?, answered_at = datetime("now") WHERE id = ?'
  ).bind(answer, qId).run()

  return c.json({ success: true })
})

// 相談所 - 相談一覧（自分の）
questions.get('/consultations', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  let query: string
  let params: any[]

  if (['admin', 'teacher'].includes(user.role)) {
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

// 相談に返答（先生・管理者）
questions.put('/consultations/:id/reply', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const cId = parseInt(c.req.param('id'))
  const { reply } = await c.req.json()

  await c.env.DB.prepare(
    'UPDATE consultations SET reply = ?, replied_at = datetime("now"), status = "closed" WHERE id = ?'
  ).bind(reply, cId).run()

  return c.json({ success: true })
})

export default questions
