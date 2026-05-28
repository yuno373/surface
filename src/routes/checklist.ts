import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'

type Bindings = { DB: any }
const checklist = new Hono<{ Bindings: Bindings }>()

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

function isManager(roles: string[]): boolean {
  return roles.some((r: string) => ['admin', 'teacher', 'chairman', 'vice_chairman'].includes(r))
}

function isPEMember(user: any): boolean {
  return user.committee === '体育委員会'
}

// チェックリスト項目一覧
checklist.get('/items', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const items = await c.env.DB.prepare(
    'SELECT pci.*, u.name as last_checked_by_name FROM pe_checklist_items pci LEFT JOIN users u ON pci.last_checked_by = u.id ORDER BY pci.name'
  ).all<any>()

  // 各項目の貸出中数
  const enriched = await Promise.all(items.results.map(async (item: any) => {
    const activeRentals = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM pe_rentals WHERE item_id = ? AND returned_at IS NULL'
    ).bind(item.id).first<any>()
    return { ...item, active_rentals: activeRentals?.cnt || 0 }
  }))

  return c.json({ items: enriched })
})

// チェックリスト項目追加（管理者・先生・委員長・副委員長）
checklist.post('/items', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isManager(roles)) return c.json({ error: 'Forbidden' }, 403)

  const { name, total_count } = await c.req.json()
  if (!name) return c.json({ error: '名前が必要です' }, 400)

  await c.env.DB.prepare(
    'INSERT INTO pe_checklist_items (name, total_count, checked, created_by) VALUES (?, ?, 0, ?)'
  ).bind(name, total_count || 1, user.id).run()

  return c.json({ success: true })
})

// チェックリスト項目編集（管理者・先生・委員長・副委員長）
checklist.put('/items/:id', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isManager(roles)) return c.json({ error: 'Forbidden' }, 403)

  const id = parseInt(c.req.param('id'))
  const { name, total_count } = await c.req.json()

  await c.env.DB.prepare(
    'UPDATE pe_checklist_items SET name = ?, total_count = ? WHERE id = ?'
  ).bind(name, total_count || 1, id).run()

  return c.json({ success: true })
})

// チェックリスト項目削除
checklist.delete('/items/:id', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user || !isManager(roles)) return c.json({ error: 'Forbidden' }, 403)

  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM pe_checklist_items WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// チェック状態の切り替え（体育委員会所属なら誰でも可）
checklist.post('/items/:id/toggle', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  // 体育委員会所属か管理者・先生かチェック
  if (!isPEMember(user) && !isManager(roles)) {
    return c.json({ error: '体育委員会のみチェックできます' }, 403)
  }

  const id = parseInt(c.req.param('id'))
  const item = await c.env.DB.prepare('SELECT * FROM pe_checklist_items WHERE id = ?').bind(id).first<any>()
  if (!item) return c.json({ error: 'Not found' }, 404)

  const newChecked = item.checked ? 0 : 1

  await c.env.DB.prepare(
    'UPDATE pe_checklist_items SET checked = ?, last_checked_by = ?, last_checked_at = datetime("now") WHERE id = ?'
  ).bind(newChecked, user.id, id).run()

  // ログ記録
  await c.env.DB.prepare(
    'INSERT INTO pe_checklist_logs (item_id, user_id, checked) VALUES (?, ?, ?)'
  ).bind(id, user.id, newChecked).run()

  return c.json({ success: true, checked: newChecked, checked_by: user.name, checked_at: new Date().toISOString() })
})

// チェック履歴
checklist.get('/items/:id/logs', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  const logs = await c.env.DB.prepare(`
    SELECT pcl.*, u.name as user_name
    FROM pe_checklist_logs pcl JOIN users u ON pcl.user_id = u.id
    WHERE pcl.item_id = ?
    ORDER BY pcl.checked_at DESC LIMIT 20
  `).bind(id).all<any>()

  return c.json({ logs: logs.results })
})

// 貸出し記録
checklist.post('/rentals', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { item_id, borrower_name, borrower_user_id, count } = await c.req.json()
  if (!item_id || !borrower_name) return c.json({ error: '必要な情報が不足しています' }, 400)

  await c.env.DB.prepare(
    'INSERT INTO pe_rentals (item_id, borrower_name, borrower_user_id, count) VALUES (?, ?, ?, ?)'
  ).bind(item_id, borrower_name, borrower_user_id || null, count || 1).run()

  return c.json({ success: true })
})

// 返却
checklist.put('/rentals/:id/return', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare(
    'UPDATE pe_rentals SET returned_at = datetime("now") WHERE id = ?'
  ).bind(id).run()

  return c.json({ success: true })
})

// 貸出し一覧
checklist.get('/rentals', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const active = await c.env.DB.prepare(`
    SELECT pr.*, pci.name as item_name, u.name as user_name
    FROM pe_rentals pr
    JOIN pe_checklist_items pci ON pr.item_id = pci.id
    LEFT JOIN users u ON pr.borrower_user_id = u.id
    WHERE pr.returned_at IS NULL
    ORDER BY pr.borrowed_at DESC
  `).all<any>()

  const history = await c.env.DB.prepare(`
    SELECT pr.*, pci.name as item_name, u.name as user_name
    FROM pe_rentals pr
    JOIN pe_checklist_items pci ON pr.item_id = pci.id
    LEFT JOIN users u ON pr.borrower_user_id = u.id
    WHERE pr.returned_at IS NOT NULL
    ORDER BY pr.returned_at DESC LIMIT 20
  `).all<any>()

  return c.json({ active: active.results, history: history.results })
})

export default checklist
