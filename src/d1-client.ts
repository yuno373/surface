// D1 HTTP API クライアント — Render から Cloudflare D1 に接続
const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

function getConfig() {
  const accountId = process.env.CF_ACCOUNT_ID
  const dbId = process.env.CF_D1_DATABASE_ID
  const apiToken = process.env.CF_API_TOKEN
  if (!accountId || !dbId || !apiToken) {
    throw new Error('環境変数 CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN が必要です')
  }
  return { accountId, dbId, apiToken }
}

class D1Statement {
  private sql: string
  private params: any[]
  constructor(sql: string) { this.sql = sql; this.params = [] }
  bind(...args: any[]) { this.params = args.map(p => p === undefined ? null : p); return this }
  async all<T = any>(): Promise<{ results: T[] }> {
    const res: any = await query(this.sql, this.params)
    return { results: res?.results || [] }
  }
  async first<T = any>(): Promise<T | null> {
    const res: any = await query(this.sql, this.params)
    return res?.results?.[0] || null
  }
  async run(): Promise<{ success: boolean; meta: { last_row_id: number; changes: number } }> {
    const res: any = await query(this.sql, this.params)
    const meta = res?.meta || {}
    return { success: true, meta: { last_row_id: meta.last_row_id || 0, changes: meta.changes || 0 } }
  }
}

async function query(sql: string, params: any[]) {
  const { accountId, dbId, apiToken } = getConfig()
  const url = `${CF_API_BASE}/accounts/${accountId}/d1/database/${dbId}/query`
  const body: any = { sql }
  if (params.length > 0) body.params = params

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`D1 API error: ${resp.status} ${err}`)
  }
  const data = await resp.json() as any
  if (!data.success) {
    const errs = data.errors?.map((e: any) => e.message).join(', ') || 'unknown error'
    throw new Error(`D1 query failed: ${errs}`)
  }
  const result = data.result?.[0]
  if (result?.error) throw new Error(`D1 query error: ${result.error}`)
  return result
}

export function createD1Client() {
  return {
    prepare(sql: string) { return new D1Statement(sql) },
    async exec(sql: string) { await query(sql, []) }
  }
}
