import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = { DB: D1Database }

const posts = new Hono<{ Bindings: Bindings }>()

// セッション取得ミドルウェア
async function getUser(c: any) {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return null
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return null
  return await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(session.user_id).first<any>()
}

// 投稿一覧取得
posts.get('/', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const category = c.req.query('category') || 'bulletin'
  const target = c.req.query('target')
  const page = parseInt(c.req.query('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  let query = 'SELECT p.*, u.name as author_name, u.role as author_role FROM posts p JOIN users u ON p.author_id = u.id WHERE p.category = ? AND (p.expires_at IS NULL OR p.expires_at > datetime("now"))'
  let params: any[] = [category]

  if (target) {
    query += ' AND p.target = ?'
    params.push(target)
  }

  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const postList = await c.env.DB.prepare(query).bind(...params).all<any>()

  // リアクション数を取得
  const postIds = postList.results.map((p: any) => p.id)
  let enriched = postList.results

  if (postIds.length > 0) {
    const placeholders = postIds.map(() => '?').join(',')
    const reactions = await c.env.DB.prepare(
      `SELECT post_id, emoji, COUNT(*) as count FROM reactions WHERE post_id IN (${placeholders}) GROUP BY post_id, emoji`
    ).bind(...postIds).all<any>()

    const reads = await c.env.DB.prepare(
      `SELECT post_id FROM post_reads WHERE post_id IN (${placeholders}) AND user_id = ?`
    ).bind(...postIds, user.id).all<any>()

    const readSet = new Set(reads.results.map((r: any) => r.post_id))
    const reactionMap: Record<number, any[]> = {}
    reactions.results.forEach((r: any) => {
      if (!reactionMap[r.post_id]) reactionMap[r.post_id] = []
      reactionMap[r.post_id].push({ emoji: r.emoji, count: r.count })
    })

    enriched = postList.results.map((p: any) => ({
      ...p,
      reactions: reactionMap[p.id] || [],
      is_read: readSet.has(p.id)
    }))
  }

  return c.json({ posts: enriched, page, limit })
})

// 投稿詳細
posts.get('/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id'))

  const post = await c.env.DB.prepare(
    'SELECT p.*, u.name as author_name, u.role as author_role FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?'
  ).bind(id).first<any>()
  if (!post) return c.json({ error: 'Not found' }, 404)

  // 既読にする
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO post_reads (post_id, user_id) VALUES (?, ?)'
  ).bind(id, user.id).run()

  // リアクション取得
  const reactions = await c.env.DB.prepare(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji'
  ).bind(id).all<any>()

  // 既読数（管理者・先生・部長・委員長のみ）
  let readCount = null
  if (['admin', 'teacher', 'captain', 'chairman'].includes(user.role)) {
    const rc = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM post_reads WHERE post_id = ?'
    ).bind(id).first<any>()
    readCount = rc?.cnt || 0

    // 誰がリアクションしたか
    const reactionDetails = await c.env.DB.prepare(
      'SELECT r.emoji, u.name FROM reactions r JOIN users u ON r.user_id = u.id WHERE r.post_id = ?'
    ).bind(id).all<any>()

    return c.json({ post: { ...post, reactions: reactions.results, readCount, reactionDetails: reactionDetails.results } })
  }

  return c.json({ post: { ...post, reactions: reactions.results, readCount } })
})

// 投稿作成
posts.post('/', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { category, target, title, content, file_url, file_type, expires_at } = body

  if (!content) return c.json({ error: '内容が必要です' }, 400)

  // 権限チェック
  const canPost = checkPostPermission(user, category, target)
  if (!canPost) return c.json({ error: '投稿権限がありません' }, 403)

  await c.env.DB.prepare(
    'INSERT INTO posts (author_id, category, target, title, content, file_url, file_type, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(user.id, category, target || null, title || null, content, file_url || null, file_type || null, expires_at || null).run()

  const newPost = await c.env.DB.prepare('SELECT last_insert_rowid() as id').first<any>()
  return c.json({ success: true, id: newPost?.id })
})

// 投稿削除
posts.delete('/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id'))

  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>()
  if (!post) return c.json({ error: 'Not found' }, 404)

  if (post.author_id !== user.id && !['admin', 'teacher'].includes(user.role)) {
    return c.json({ error: '削除権限がありません' }, 403)
  }

  await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// 一括削除（管理者・先生）
posts.delete('/', async (c) => {
  const user = await getUser(c)
  if (!user || !['admin', 'teacher'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  const { ids } = await c.req.json()
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'IDリストが必要です' }, 400)

  const placeholders = ids.map(() => '?').join(',')
  await c.env.DB.prepare(`DELETE FROM posts WHERE id IN (${placeholders})`).bind(...ids).run()
  return c.json({ success: true })
})

// リアクション追加/削除
posts.post('/:id/react', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id'))
  const { emoji } = await c.req.json()

  const existing = await c.env.DB.prepare(
    'SELECT * FROM reactions WHERE post_id = ? AND user_id = ? AND emoji = ?'
  ).bind(id, user.id, emoji).first()

  if (existing) {
    await c.env.DB.prepare('DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND emoji = ?')
      .bind(id, user.id, emoji).run()
    return c.json({ action: 'removed' })
  } else {
    await c.env.DB.prepare('INSERT INTO reactions (post_id, user_id, emoji) VALUES (?, ?, ?)')
      .bind(id, user.id, emoji).run()
    return c.json({ action: 'added' })
  }
})

function checkPostPermission(user: any, category: string, target: string): boolean {
  if (['admin', 'teacher'].includes(user.role)) return true
  if (category === 'bulletin') return false
  if (category === 'school_notice') return false
  if (category === 'lost_item') {
    return ['captain', 'chairman', 'vice_captain', 'vice_chairman'].includes(user.role)
  }
  if (category === 'club') {
    return ['captain', 'vice_captain'].includes(user.role) && user.club === target
  }
  if (category === 'committee') {
    return ['chairman', 'vice_chairman'].includes(user.role) && user.committee === target
  }
  if (category === 'class') return false
  return false
}

export default posts
