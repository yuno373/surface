import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import webpush from 'web-push'

type Bindings = { DB: any }

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

const posts = new Hono<{ Bindings: Bindings }>()

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

posts.get('/', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const category = c.req.query('category') || 'bulletin'
  const target = c.req.query('target')
  const page = parseInt(c.req.query('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  let query = `SELECT p.*, u.name as author_name, u.role as author_role FROM posts p JOIN users u ON p.author_id = u.id WHERE p.category = ? AND (p.expires_at IS NULL OR p.expires_at > datetime("now"))`
  let params: any[] = [category]

  if (target) {
    query += ' AND p.target = ?'
    params.push(target)
  }

  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const postList = await c.env.DB.prepare(query).bind(...params).all<any>()
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

posts.get('/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id'))

  const post = await c.env.DB.prepare(
    'SELECT p.*, u.name as author_name, u.role as author_role FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?'
  ).bind(id).first<any>()
  if (!post) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO post_reads (post_id, user_id) VALUES (?, ?)'
  ).bind(id, user.id).run()

  const reactions = await c.env.DB.prepare(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY emoji'
  ).bind(id).all<any>()

  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))

  let readCount = null
  if (isStaff) {
    const rc = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM post_reads WHERE post_id = ?'
    ).bind(id).first<any>()
    readCount = rc?.cnt || 0

    const reactionDetails = await c.env.DB.prepare(
      'SELECT r.emoji, u.name FROM reactions r JOIN users u ON r.user_id = u.id WHERE r.post_id = ?'
    ).bind(id).all<any>()

    return c.json({ post: { ...post, reactions: reactions.results, readCount, reactionDetails: reactionDetails.results } })
  }

  return c.json({ post: { ...post, reactions: reactions.results, readCount } })
})

posts.post('/', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { category, target, title, content, file_url, file_type, expires_at, is_important } = body

  if (!content) return c.json({ error: '内容が必要です' }, 400)

  const roles = await getUserRoles(c.env.DB, user.id)
  const canPost = checkPostPermission(roles, user, category, target)
  if (!canPost) return c.json({ error: '投稿権限がありません' }, 403)

  // 最大2ヶ月、最低1日
  let finalExpires = expires_at || null
  if (finalExpires) {
    const expDate = new Date(finalExpires)
    const maxDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    const minDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    if (expDate > maxDate) finalExpires = maxDate.toISOString()
    if (expDate < minDate) finalExpires = minDate.toISOString()
  }

  await c.env.DB.prepare(
    'INSERT INTO posts (author_id, category, target, title, content, file_url, file_type, expires_at, is_important) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(user.id, category, target || null, title || null, content, file_url || null, file_type || null, finalExpires, is_important ? 1 : 0).run()

  const newPost = await c.env.DB.prepare('SELECT last_insert_rowid() as id').first<any>()

  // プッシュ通知を送信
  try {
    const notifMessage = title || content
    let pushUsers: any[] = []
    if (category === 'school_notice') {
      pushUsers = (await c.env.DB.prepare(
        "SELECT ns.push_subscription FROM notification_settings ns WHERE ns.school_notice_enabled = 1 AND ns.push_subscription IS NOT NULL AND ns.push_subscription != ''"
      ).all<any>()).results
    } else if ((category === 'club' || category === 'committee') && target) {
      pushUsers = (await c.env.DB.prepare(
        `SELECT ns.push_subscription FROM notification_settings ns JOIN users u ON ns.user_id = u.id WHERE ns.push_enabled = 1 AND ns.push_subscription IS NOT NULL AND ns.push_subscription != '' AND u.${category} = ?`
      ).bind(target).all<any>()).results
    }
    if (pushUsers.length > 0 && vapidPublicKey) {
      const pushPayload = JSON.stringify({ title: '上中黒板', body: notifMessage, type: 'post' })
      for (const pu of pushUsers) {
        try { await webpush.sendNotification(JSON.parse(pu.push_subscription), pushPayload) } catch {}
      }
    }
  } catch {}

  return c.json({ success: true, id: newPost?.id })
})

posts.put('/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id'))

  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>()
  if (!post) return c.json({ error: 'Not found' }, 404)

  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))
  if (post.author_id !== user.id && !isStaff) {
    return c.json({ error: '編集権限がありません' }, 403)
  }

  const body = await c.req.json()
  const { title, content, expires_at, is_important } = body

  let fields: string[] = ['updated_at = datetime("now")']
  let params: any[] = []
  if (title !== undefined) { fields.push('title = ?'); params.push(title) }
  if (content !== undefined) { fields.push('content = ?'); params.push(content) }
  if (expires_at !== undefined) { fields.push('expires_at = ?'); params.push(expires_at) }
  if (is_important !== undefined) { fields.push('is_important = ?'); params.push(is_important ? 1 : 0) }
  params.push(id)

  await c.env.DB.prepare(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run()
  return c.json({ success: true })
})

posts.delete('/:id', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id'))

  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>()
  if (!post) return c.json({ error: 'Not found' }, 404)

  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))
  if (post.author_id !== user.id && !isStaff) {
    return c.json({ error: '削除権限がありません' }, 403)
  }

  await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

posts.delete('/', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))
  if (!user || !isStaff) return c.json({ error: 'Forbidden' }, 403)

  const { ids } = await c.req.json()
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'IDリストが必要です' }, 400)

  const placeholders = ids.map(() => '?').join(',')
  await c.env.DB.prepare(`DELETE FROM posts WHERE id IN (${placeholders})`).bind(...ids).run()
  return c.json({ success: true })
})

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

// 既読ユーザー一覧（管理者・先生・投稿者）
posts.get('/:id/readers', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id'))

  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>()
  if (!post) return c.json({ error: 'Not found' }, 404)

  const roles = await getUserRoles(c.env.DB, user.id)
  const isStaff = roles.some((r: string) => ['admin', 'teacher'].includes(r))
  if (post.author_id !== user.id && !isStaff) {
    return c.json({ error: '権限がありません' }, 403)
  }

  const readers = await c.env.DB.prepare(
    'SELECT u.id, u.name, u.role, pr.read_at FROM post_reads pr JOIN users u ON pr.user_id = u.id WHERE pr.post_id = ? ORDER BY pr.read_at ASC'
  ).bind(id).all<any>()

  return c.json({ readers: readers.results })
})

function checkPostPermission(roles: string[], user: any, category: string, target: string): boolean {
  // 管理者と先生は全カテゴリに投稿可
  if (roles.some((r: string) => ['admin', 'teacher'].includes(r))) return true
  // 生徒会は club/committee/lost_item に投稿可
  const isStudentCouncil = roles.includes('student_council')
  if (isStudentCouncil && ['club', 'committee', 'lost_item'].includes(category)) return true
  // 掲示板・上中連絡は管理者のみ
  if (['bulletin', 'school_notice'].includes(category)) return false
  // 忘れ物: 部長・委員長・副部長・副委員長
  if (category === 'lost_item') {
    return roles.some((r: string) => ['captain', 'chairman', 'vice_captain', 'vice_chairman'].includes(r))
  }
  // 部活動: 自分の部活の部長・副部長のみ
  if (category === 'club') {
    return roles.some((r: string) => ['captain', 'vice_captain'].includes(r)) && user.club === target
  }
  // 委員会: 自分の委員会の委員長・副委員長のみ
  if (category === 'committee') {
    return roles.some((r: string) => ['chairman', 'vice_chairman'].includes(r)) && user.committee === target
  }
  // クラス掲示板は生徒も投稿可
  if (category === 'class') return true
  return false
}

export default posts
