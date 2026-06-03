import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = { DB: any }
const surveys = new Hono<{ Bindings: Bindings }>()

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

function isTargetMatch(survey: any, user: any): boolean {
  if (!survey.target || survey.target === 'all') return true
  if (survey.target === 'class') return user.grade && user.class_num && `${user.grade}-${user.class_num}` === survey.target_value
  if (survey.target === 'club') return user.club === survey.target_value
  if (survey.target === 'committee') return user.committee === survey.target_value
  return true
}

// アンケート一覧
surveys.get('/', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const role = user.role
  const roles = await getUserRoles(c.env.DB, user.id)

  let surveys
  if (roles.some((r: string) => ['admin', 'teacher'].includes(r))) {
    surveys = await c.env.DB.prepare(`
      SELECT s.*, u.name as creator_name,
        (SELECT COUNT(*) FROM survey_questions WHERE survey_id = s.id) as question_count,
        (SELECT COUNT(DISTINCT user_id) FROM survey_answers WHERE survey_id = s.id) as answer_count
      FROM surveys s JOIN users u ON s.created_by = u.id
      ORDER BY s.created_at DESC
    `).all<any>()
  } else {
    surveys = await c.env.DB.prepare(`
      SELECT s.*, u.name as creator_name,
        (SELECT COUNT(*) FROM survey_questions WHERE survey_id = s.id) as question_count,
        (SELECT COUNT(DISTINCT user_id) FROM survey_answers WHERE survey_id = s.id) as answer_count,
        (SELECT COUNT(*) FROM survey_answers WHERE survey_id = s.id AND user_id = ?) as my_answer_count
      FROM surveys s JOIN users u ON s.created_by = u.id
      WHERE (s.expires_at IS NULL OR s.expires_at > datetime("now"))
      ORDER BY s.created_at DESC
    `).bind(user.id).all<any>()
    surveys.results = surveys.results.filter(s => isTargetMatch(s, user))
  }

  return c.json({ surveys: surveys.results })
})

// アンケート詳細（質問含む）
surveys.get('/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id'))

  const survey = await c.env.DB.prepare(
    'SELECT s.*, u.name as creator_name FROM surveys s JOIN users u ON s.created_by = u.id WHERE s.id = ?'
  ).bind(id).first<any>()
  if (!survey) return c.json({ error: 'Not found' }, 404)

  const questions = await c.env.DB.prepare(
    'SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY order_num ASC'
  ).bind(id).all<any>()

  // 自分の回答
  const myAnswers = await c.env.DB.prepare(
    'SELECT * FROM survey_answers WHERE survey_id = ? AND user_id = ?'
  ).bind(id, user.id).all<any>()

  // 集計（管理者・先生のみ）
  const roles = await getUserRoles(c.env.DB, user.id)
  let aggregation: any = null
  if (roles.some((r: string) => ['admin', 'teacher'].includes(r))) {
    aggregation = {}
    for (const q of questions.results) {
      const answers = await c.env.DB.prepare(
        'SELECT answer, COUNT(*) as cnt FROM survey_answers WHERE question_id = ? GROUP BY answer'
      ).bind(q.id).all<any>()
      aggregation[q.id] = answers.results
    }
  }

  return c.json({ survey, questions: questions.results, myAnswers: myAnswers.results, aggregation })
})

// アンケート作成（管理者・先生のみ）
surveys.post('/', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !roles.some((r: string) => ['admin', 'teacher'].includes(r))) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const { title, description, questions, expires_at, target, target_value } = await c.req.json()
  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return c.json({ error: 'タイトルと質問が必要です' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO surveys (title, description, created_by, expires_at, target, target_value) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(title, description || null, user.id, expires_at || null, target || 'all', target_value || null).run()

  const surveyId = result.meta.last_row_id

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    await c.env.DB.prepare(
      'INSERT INTO survey_questions (survey_id, question_text, question_type, options, order_num) VALUES (?, ?, ?, ?, ?)'
    ).bind(surveyId, q.text, q.type || 'single', q.options ? JSON.stringify(q.options) : null, i).run()
  }

  // 対象がクラス・委員会・部活の場合、該当カテゴリに自動投稿
  if (target !== 'all' && target_value) {
    let postCat: string
    if (target === 'committee') postCat = 'committee'
    else if (target === 'club') postCat = 'club'
    else if (target === 'class') postCat = 'class'
    else postCat = ''
    if (postCat) {
      const content = 'アンケートが作成されました。「上中連絡」タブの「アンケート」から回答できます。' + (description ? '\n\n' + description : '')
      const postExpires = expires_at || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      await c.env.DB.prepare(
        'INSERT INTO posts (author_id, category, target, title, content, expires_at, is_important) VALUES (?, ?, ?, ?, ?, ?, 1)'
      ).bind(user.id, postCat, target_value, '【アンケート】' + title, content, postExpires).run()
    }
  }

  return c.json({ success: true, survey_id: surveyId })
})

// アンケート編集（管理者・先生のみ）
surveys.put('/:id', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !roles.some((r: string) => ['admin', 'teacher'].includes(r))) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const id = parseInt(c.req.param('id'))
  const { title, description, questions, expires_at, target, target_value } = await c.req.json()

  if (title !== undefined) {
    await c.env.DB.prepare(
      'UPDATE surveys SET title = ?, description = ?, expires_at = ?, target = ?, target_value = ? WHERE id = ?'
    ).bind(title, description || null, expires_at || null, target || 'all', target_value || null, id).run()
  }

  if (questions && Array.isArray(questions)) {
    await c.env.DB.prepare('DELETE FROM survey_questions WHERE survey_id = ?').bind(id).run()
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      await c.env.DB.prepare(
        'INSERT INTO survey_questions (survey_id, question_text, question_type, options, order_num) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, q.text, q.type || 'single', q.options ? JSON.stringify(q.options) : null, i).run()
    }
  }

  return c.json({ success: true })
})

// アンケート削除
surveys.delete('/:id', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !roles.some((r: string) => ['admin', 'teacher'].includes(r))) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM surveys WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// 回答送信
surveys.post('/:id/answers', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const surveyId = parseInt(c.req.param('id'))
  const { answers } = await c.req.json()

  const survey = await c.env.DB.prepare(
    'SELECT * FROM surveys WHERE id = ? AND (expires_at IS NULL OR expires_at > datetime("now"))'
  ).bind(surveyId).first<any>()
  if (!survey) return c.json({ error: 'アンケートが見つからないか期限切れです' }, 404)

  // 対象者チェック
  if (!isTargetMatch(survey, user)) {
    return c.json({ error: 'このアンケートはあなたの対象ではありません' }, 403)
  }

  // 既存回答をチェック
  const existing = await c.env.DB.prepare(
    'SELECT id FROM survey_answers WHERE survey_id = ? AND user_id = ? LIMIT 1'
  ).bind(surveyId, user.id).first()

  if (existing) {
    return c.json({ error: '既に回答済みです。再回答はできません。' }, 400)
  }

  for (const a of answers) {
    await c.env.DB.prepare(
      'INSERT INTO survey_answers (survey_id, question_id, user_id, answer) VALUES (?, ?, ?, ?)'
    ).bind(surveyId, a.question_id, user.id, JSON.stringify(a.answer)).run()
  }

  return c.json({ success: true })
})

// アンケート結果（全ユーザー閲覧可）
surveys.get('/:id/results', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const id = parseInt(c.req.param('id'))
    const survey = await c.env.DB.prepare('SELECT * FROM surveys WHERE id = ?').bind(id).first<any>()
    if (!survey) return c.json({ error: 'Not found' }, 404)

    const questions = await c.env.DB.prepare(
      'SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY order_num ASC'
    ).bind(id).all<any>()

    const results: any[] = []
    for (const q of questions.results) {
      if (q.question_type === 'text') {
        const answers = await c.env.DB.prepare(
          'SELECT sa.answer, u.name as user_name, u.id as user_id FROM survey_answers sa JOIN users u ON sa.user_id = u.id WHERE sa.question_id = ? ORDER BY sa.created_at ASC'
        ).bind(q.id).all<any>()
        results.push({ question: q, answers: answers.results, total: answers.results.length })
      } else {
        const answers = await c.env.DB.prepare(
          'SELECT sa.answer, COUNT(*) as cnt FROM survey_answers sa WHERE question_id = ? GROUP BY sa.answer ORDER BY cnt DESC'
        ).bind(q.id).all<any>()
        const voters = await c.env.DB.prepare(
          'SELECT sa.answer, u.name as user_name, u.id as user_id FROM survey_answers sa JOIN users u ON sa.user_id = u.id WHERE sa.question_id = ? ORDER BY sa.answer, u.name'
        ).bind(q.id).all<any>()
        const votersByAnswer: Record<string, { user_name: string; user_id: number }[]> = {}
        for (const v of voters.results) {
          const key = typeof v.answer === 'string' ? v.answer : JSON.stringify(v.answer)
          if (!votersByAnswer[key]) votersByAnswer[key] = []
          votersByAnswer[key].push({ user_name: v.user_name, user_id: v.user_id })
        }
        const total = answers.results.reduce((sum: number, a: any) => sum + a.cnt, 0)
        results.push({
          question: q,
          answers: answers.results.map((a: any) => ({ ...a, voters: votersByAnswer[a.answer] || [] })),
          total
        })
      }
    }

    const totalRespondents = await c.env.DB.prepare(
      'SELECT COUNT(DISTINCT user_id) as cnt FROM survey_answers WHERE survey_id = ?'
    ).bind(id).first<any>()

    return c.json({
      survey,
      results,
      totalRespondents: totalRespondents?.cnt || 0
    })
  } catch (e: any) {
    return c.json({ error: '集計失敗: ' + (e.message || e) }, 500)
  }
})

export default surveys
