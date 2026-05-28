import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = { DB: any; R2: any }

const upload = new Hono<{ Bindings: Bindings }>()

async function getUser(c: any) {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return null
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<any>()
  if (!session) return null
  return await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<any>()
}

// ファイルアップロード（R2）
upload.post('/', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'ファイルが必要です' }, 400)

  // ファイルサイズ制限（10MB）
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return c.json({ error: 'ファイルサイズは10MB以下にしてください' }, 400)
  }

  // 許可するMIMEタイプ
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: '許可されていないファイル形式です（画像またはPDFのみ）' }, 400)
  }

  // 一意のファイル名を生成
  const ext = file.name.split('.').pop() || 'bin'
  const r2Key = `uploads/${user.id}/${Date.now()}-${crypto.randomUUID().substring(0, 8)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  await c.env.R2.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name, userId: String(user.id) }
  })

  // DBに記録
  const publicUrl = `/api/upload/${r2Key}`
  await c.env.DB.prepare(
    'INSERT INTO files (user_id, filename, original_name, mime_type, size, r2_key) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.id, r2Key, file.name, file.type, file.size, r2Key).run()

  return c.json({
    success: true,
    url: publicUrl,
    filename: file.name,
    mime_type: file.type,
    size: file.size
  })
})

// ファイル取得
upload.get('/:key+', async (c) => {
  const key = c.req.param('key')

  // アクセス認証
  const sessionId = getCookie(c, 'session')
  if (sessionId) {
    const session = await c.env.DB.prepare(
      'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
    ).bind(sessionId).first<any>()
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
  } else {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const object = await c.env.R2.get(key)
  if (!object) return c.json({ error: 'Not found' }, 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=31536000')

  return new Response(object.body, { headers })
})

// ファイル削除
upload.delete('/:key+', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const key = c.req.param('key')
  const file = await c.env.DB.prepare(
    'SELECT * FROM files WHERE r2_key = ? AND user_id = ?'
  ).bind(key, user.id).first<any>()

  if (!file) {
    // 管理者は全ファイル削除可
    const roles = await c.env.DB.prepare('SELECT role FROM user_roles WHERE user_id = ?').bind(user.id).all<any>()
    const isStaff = roles.results.some((r: any) => ['admin', 'teacher'].includes(r.role))
    if (!isStaff) return c.json({ error: 'Not found' }, 404)
  }

  await c.env.R2.delete(key)
  await c.env.DB.prepare('DELETE FROM files WHERE r2_key = ?').bind(key).run()

  return c.json({ success: true })
})

export default upload
