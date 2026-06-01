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

  const roles = await getUserRoles(c.env.DB, user.id)
  const canCheck = isPEMember(user) || isManager(roles)

  // 各項目の貸出中数
  const enriched = await Promise.all(items.results.map(async (item: any) => {
    const activeRentals = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM pe_rentals WHERE item_id = ? AND returned_at IS NULL'
    ).bind(item.id).first<any>()
    return {
      id: item.id,
      name: item.name,
      total_count: item.total_count,
      status: item.checked ? 'ok' : 'ng',
      can_check: canCheck,
      location: item.location || '',
      last_checker: item.last_checked_by_name || null,
      last_checked: item.last_checked_at || null,
      active_rentals: activeRentals?.cnt || 0
    }
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
checklist.post('/items/:id/check', async (c) => {
  const user = await getUser(c)
  const roles = await getUserRoles(c.env.DB, user.id)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!isPEMember(user) && !isManager(roles)) {
    return c.json({ error: '体育委員会のみチェックできます' }, 403)
  }
  const id = parseInt(c.req.param('id'))
  const { status } = await c.req.json()
  const newChecked = status === 'ok' ? 1 : 0
  const item = await c.env.DB.prepare('SELECT * FROM pe_checklist_items WHERE id = ?').bind(id).first<any>()
  if (!item) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare(
    'UPDATE pe_checklist_items SET checked = ?, last_checked_by = ?, last_checked_at = datetime("now") WHERE id = ?'
  ).bind(newChecked, user.id, id).run()
  await c.env.DB.prepare(
    'INSERT INTO pe_checklist_logs (item_id, user_id, checked) VALUES (?, ?, ?)'
  ).bind(id, user.id, newChecked).run()
  return c.json({ success: true, status, checked_by: user.name, checked_at: new Date().toISOString() })
})

// 互換性: 既存のtoggleエンドポイント
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

// 全点検履歴
checklist.get('/history', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const history = await c.env.DB.prepare(`
    SELECT pcl.*, pci.name as item_name, u.name as checker_name
    FROM pe_checklist_logs pcl
    JOIN pe_checklist_items pci ON pcl.item_id = pci.id
    JOIN users u ON pcl.user_id = u.id
    ORDER BY pcl.checked_at DESC LIMIT 50
  `).all<any>()
  return c.json({ history: history.results.map(h => ({
    item_name: h.item_name,
    checker_name: h.checker_name,
    status: h.checked ? 'ok' : 'ng',
    created_at: h.checked_at
  })) })
})

// 貸出し記録
checklist.post('/rentals', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  try { await c.env.DB.prepare('ALTER TABLE pe_rentals ADD COLUMN notes TEXT').run() } catch {}

  const { item_id, borrower_name, borrower_user_id, borrower_id, count, notes } = await c.req.json()
  if (!item_id) return c.json({ error: '必要な情報が不足しています' }, 400)

  let finalBorrowerName = borrower_name || ''
  const finalBorrowerUserId = borrower_user_id || borrower_id || null

  // borrower_idから名前を取得
  if (!finalBorrowerName && finalBorrowerUserId) {
    const u = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(finalBorrowerUserId).first<any>()
    if (u) finalBorrowerName = u.name
  }
  if (!finalBorrowerName) return c.json({ error: '借りる人の名前が必要です' }, 400)

  await c.env.DB.prepare(
    'INSERT INTO pe_rentals (item_id, borrower_name, borrower_user_id, count, notes) VALUES (?, ?, ?, ?, ?)'
  ).bind(item_id, finalBorrowerName, finalBorrowerUserId, count || 1, notes || null).run()

  return c.json({ success: true })
})

// 返却
checklist.post('/rentals/:id/return', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare(
    'UPDATE pe_rentals SET returned_at = datetime("now") WHERE id = ?'
  ).bind(id).run()

  return c.json({ success: true })
})

// PUT互換性
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

  const rentals = await c.env.DB.prepare(`
    SELECT pr.*, pci.name as item_name, pci.total_count,
      (SELECT COUNT(*) FROM pe_rentals pr2 WHERE pr2.item_id = pr.item_id AND pr2.returned_at IS NULL) as active_rentals,
      u.name as user_name
    FROM pe_rentals pr
    JOIN pe_checklist_items pci ON pr.item_id = pci.id
    LEFT JOIN users u ON pr.borrower_user_id = u.id
    ORDER BY pr.borrowed_at DESC LIMIT 50
  `).all<any>()

  return c.json({ rentals: rentals.results.map(r => ({
    id: r.id, item_name: r.item_name, total_count: r.total_count, active_rentals: r.active_rentals || 0,
    borrower_name: r.borrower_name || r.user_name || '',
    borrowed_at: r.borrowed_at, returned_at: r.returned_at,
    notes: r.notes || '', count: r.count || 1
  })) })
})

export default checklist
