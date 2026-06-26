import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import webpush from 'web-push'
import auth from './routes/auth'
import posts from './routes/posts'
import messages from './routes/messages'
import admin from './routes/admin'
import questions from './routes/questions'
import surveys from './routes/surveys'
import checklist from './routes/checklist'
import upload from './routes/upload'
import { createD1Client } from './d1-client'
import { createR2Client } from './r2-client'

type Env = { DB: any; R2: any; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string }
const app = new Hono<{ Bindings: Env }>()
let db: any, r2: any
try { db = createD1Client(); r2 = createR2Client() } catch {}

// マイグレーション（不足カラム追加）
let _migrated = false
async function runMigrations() {
  if (_migrated) return
  _migrated = true
  const accountId = process.env.CF_ACCOUNT_ID
  const dbId = process.env.CF_D1_DATABASE_ID
  const apiToken = process.env.CF_API_TOKEN
  if (!accountId || !dbId || !apiToken) return
  try {
    const chk = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: "PRAGMA table_info(survey_answers)", params: [] })
    })
    const chkData = await chk.json() as any
    const hasAnswer = chkData?.result?.[0]?.results?.some((r: any) => r.name === 'answer')
    if (!hasAnswer) {
      await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: "ALTER TABLE survey_answers ADD COLUMN answer TEXT DEFAULT ''", params: [] })
      })
    }
  } catch {}
}
runMigrations()
runMigrations()

app.use('*', async (c, next) => {
  if (!db) try { db = createD1Client(); r2 = createR2Client(); runMigrations() } catch {}
  if (!r2) try { r2 = createR2Client() } catch {}
  c.env = { ...c.env, DB: db, R2: r2 }
  await next()
})

app.use('/api/*', cors({ origin: ['https://surface-7tsp.onrender.com', 'http://localhost:3000'], credentials: true }))
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    fontSrc: ["'self'", "https://cdn.jsdelivr.net", "data:"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
  }
}))

// CSP違反レポート受付
app.post('/api/csp-report', async (c) => {
  try {
    const report = await c.req.json()
    console.log('[CSP-Report]', JSON.stringify(report))
  } catch {}
  return c.json({ ok: true })
})

app.route('/api/auth', auth)
app.route('/api/posts', posts)
app.route('/api/messages', messages)
app.route('/api/admin', admin)
app.route('/api/questions', questions)
app.route('/api/surveys', surveys)
app.route('/api/checklist', checklist)
app.route('/api/upload', upload)

app.get('/api/notifications/vapid-key', (c) => {
  const publicKey = c.env.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || ''
  return c.json({ publicKey })
})

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

app.get('/api/wbgt', async (c) => {
  try {
    const resp = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=35.8397&longitude=139.3912&current=temperature_2m,relative_humidity_2m,weather_code',
      { signal: AbortSignal.timeout(15000) }
    )
    if (resp.ok) {
      const data = await resp.json() as any
      const ta = data?.current?.temperature_2m
      const rh = data?.current?.relative_humidity_2m
      const wc = data?.current?.weather_code
      const weatherMap: Record<number, string> = {0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌦',56:'🌧',57:'🌧',61:'🌧',63:'🌧',65:'🌧',66:'🌧',67:'🌧',71:'❄️',73:'❄️',75:'❄️',77:'❄️',80:'🌦',81:'🌦',82:'🌦',85:'❄️',86:'❄️',95:'⛈',96:'⛈',99:'⛈'}
      const weatherDesc: Record<number, string> = {0:'快晴',1:'晴れ',2:'薄曇り',3:'曇り',45:'霧',48:'霧',51:'小雨',53:'適度な雨',55:'強い雨',56:'氷雨（弱）',57:'氷雨（強）',61:'雨（弱）',63:'雨（中）',65:'雨（強）',66:'凍雨（弱）',67:'凍雨（強）',71:'雪（弱）',73:'雪（中）',75:'雪（強）',77:'霰',80:'にわか雨（弱）',81:'にわか雨（中）',82:'にわか雨（強）',85:'にわか雪（弱）',86:'にわか雪（強）',95:'雷雨',96:'雹を伴う雷雨',99:'強い雹を伴う雷雨'}
      const weather = wc != null ? (weatherMap[wc] || '') + (weatherDesc[wc] || '') : ''
      if (ta != null && rh != null) {
        const tw = ta * Math.atan(0.151977 * Math.sqrt(rh + 8.313659))
          + Math.atan(ta + rh)
          - Math.atan(rh - 1.676331)
          + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh)
          - 4.686035
        const wbgt = 0.7 * tw + 0.3 * ta
        let level = '注意'
        let alert: string|null = null
        if (wbgt >= 31) { level = '危険'; alert = '運動は原則中止' }
        else if (wbgt >= 28) { level = '危険'; alert = '激しい運動は中止' }
        else if (wbgt >= 25) { level = '厳重警戒'; alert = '積極的に休息' }
        else if (wbgt >= 21) { level = '警戒'; alert = 'こまめに休息' }
        return c.json({ wbgt: Math.round(wbgt * 10) / 10, level, alert, temp: ta, humidity: rh, weather })
      }
    }
  } catch {}
  return c.json({ wbgt: null, level: null, alert: null })
})

// 気象庁警報コード→日本語(レベル)
const JMA_WARNINGS: Record<string, string> = {'08':'高潮警報','07':'波浪警報','06':'大雪警報','05':'暴風警報','02':'暴風雪警報','03':'大雨警報','04':'洪水警報','10':'大雨注意報','18':'洪水注意報','15':'強風注意報','16':'波浪注意報','14':'雷注意報','13':'風雪注意報','12':'大雪注意報','20':'濃霧注意報','21':'乾燥注意報','22':'なだれ注意報','23':'低温注意報','24':'霜注意報','25':'着氷注意報','26':'着雪注意報','17':'融雪注意報'}
const WARN_LEVEL = (c: string) => ['08','07','06','05','02','03','04'].includes(c) ? 4 : ['10','18','15','16','14','13','12','20','21','22','23','24','25','26','17'].includes(c) ? 2 : 3

// 現在の防災情報を取得（DB通知 + 気象庁自動警報＋予報）
let _disasterCache: { data: any; time: number } | null = null
app.get('/api/disaster/current', async (c) => {
  if (_disasterCache && Date.now() - _disasterCache.time < 60000) return c.json(_disasterCache.data)
  let jma: { title: string; level: number } | null = null
  let forecast: { title: string; level: number } | null = null
  // 1. 気象庁警報API
  try {
    const resp = await fetch('https://www.jma.go.jp/bosai/warning/data/warning/110000.json', { signal: AbortSignal.timeout(5000) })
    if (resp.ok) {
      const data = await resp.json() as any
      const warnings: { label: string; code: string; level: number }[] = []
      for (const at of (data?.areaTypes || [])) {
        for (const area of (at?.areas || [])) {
          if (area.code === '110010') {
            for (const w of (area.warnings || [])) {
              if (w.code && w.status !== '解除' && JMA_WARNINGS[w.code]) warnings.push({ label: JMA_WARNINGS[w.code], code: w.code, level: WARN_LEVEL(w.code) })
            }
          }
        }
      }
      const severityOrder = ['08','07','06','05','02','03','04','10','18','15','16','14','20','21','22','23','24','25','26']
      warnings.sort((a, b) => severityOrder.indexOf(a.code) - severityOrder.indexOf(b.code))
      if (warnings.length > 0) {
        const maxLevel = Math.max(...warnings.map(w => w.level))
        jma = { title: warnings.map(w => w.label).join('、'), level: maxLevel }
      }
    }
  } catch {}
  // 2. 気象庁予報API（大雨・強風を検出）
  try {
    const fResp = await fetch('https://www.jma.go.jp/bosai/forecast/data/forecast/110000.json', { signal: AbortSignal.timeout(5000) })
    if (fResp.ok) {
      const fData = await fResp.json() as any
      const heavyRain: string[] = []
      let maxFLevel = 0
      for (const report of fData || []) {
        for (const ts of (report?.timeSeries || [])) {
          for (const area of (ts?.areas || [])) {
            if (area.area?.code === '110010' && area.pops) {
              if (parseInt(area.pops[0]) >= 80) { heavyRain.push('大雨(降水確率' + area.pops[0] + '%)'); maxFLevel = Math.max(maxFLevel, 2) }
            }
            if (area.area?.code === '110010' && area.weathers) {
              const w = area.weathers[0] || ''
              if (w.includes('雷')) {
                if (!heavyRain.some(h => h.startsWith('雷'))) heavyRain.push('雷注意')
                maxFLevel = Math.max(maxFLevel, 2)
              }
              if (w.includes('激しく') || w.includes('非常に')) {
                if (!heavyRain.some(h => h.startsWith('大雨'))) heavyRain.push('大雨注意')
                maxFLevel = Math.max(maxFLevel, 2)
              }
              if (w.includes('強風') || w.includes('暴風')) { heavyRain.push('強風注意'); maxFLevel = Math.max(maxFLevel, 2) }
            }
          }
        }
      }
      if (heavyRain.length > 0) forecast = { title: heavyRain.join('、'), level: maxFLevel }
    }
  } catch {}
  // 3. DBの管理者防災通知
  let db: any = null
  try {
    db = await c.env.DB.prepare(
      "SELECT title, body, created_at FROM notifications WHERE type LIKE '%disaster%' OR type LIKE '%災害%' ORDER BY created_at DESC LIMIT 1"
    ).first<any>()
  } catch {}
  // マージ
  const parts: string[] = []
  let level = 0
  if (jma) { parts.push(jma.title); level = Math.max(level, jma.level) }
  if (forecast && !jma) { parts.push(forecast.title); level = Math.max(level, forecast.level) }
  if (db) parts.push((db.title || '') + (db.body ? ': ' + db.body : ''))
  const result = { title: parts.length > 0 ? parts.join(' | ') : null, level }
  _disasterCache = { data: result, time: Date.now() }
  return c.json(result)
})

// 地震情報（P2PQuake → 緊急地震速報・地震情報）
const SCALE_LABELS: Record<number, string> = {0:'0',1:'1',2:'2',3:'3',4:'4',45:'5弱',46:'5強',50:'5弱',55:'5強',60:'6弱',66:'6強',70:'6弱',77:'6強',80:'7'}
let _eqCache: { data: any; time: number } | null = null
let _lastEqId = ''
// 地震情報マージ（複数ソース中最速のものを採用）
type EqResult = { id:string; isEew:boolean; time:string; type:string; magnitude:number|null; depth:string; location:string; maxScale:number; scaleLabel:string; isNew:boolean; serious:boolean }
async function _eqRace(): Promise<EqResult|null> {
  const sources = [_fetchP2PQuake(), _fetchWolfx(), _fetchYDITS()]
  const winner = await new Promise<EqResult|null>(resolve => {
    let done = false
    for (const p of sources) {
      p.then(r => { if (!done && r) { done = true; resolve(r) } }).catch(() => {})
    }
    Promise.allSettled(sources).then(() => { if (!done) { done = true; resolve(null) } })
  })
  return winner
}
// P2PQuake: 地震情報＋EEW
async function _fetchP2PQuake(): Promise<EqResult|null> {
  try {
    const resp = await fetch('https://api.p2pquake.net/v2/history?codes=551&codes=556&limit=3', { signal: AbortSignal.timeout(3000) })
    if (!resp.ok) return null
    const list = await resp.json() as any[]
    if (!list?.length) return null
    // EEW (556) 優先、なければ直近の551
    const eew = list.find((d:any) => d.code === 556)
    const top = eew || list[0]
    if (!top) return null
    // EEW556はearthquakeオブジェクトなし → 551からhypocenter補完
    let eq = top.earthquake
    if (!eq && eew && list.some((d:any) => d.code === 551)) {
      const eq551 = list.find((d:any) => d.code === 551)
      eq = eq551?.earthquake || null
    }
    const isEew = top.code === 556
    const id = top.id || top.time || ''
    const maxScale = eq?.maxScale ?? top.maxScale ?? -1
    const scaleLabel = SCALE_LABELS[maxScale] || ''
    return { id, isEew, time: top.time || '', type: top.code === 551 ? (top.issue?.type||'地震情報') : '緊急地震速報（警報）', magnitude: eq?.magnitude ?? null, depth: eq?.hypocenter?.depth != null ? eq.hypocenter.depth + 'km' : '', location: eq?.hypocenter?.name || '', maxScale, scaleLabel, isNew: id !== _lastEqId, serious: isEew || maxScale >= 40 }
  } catch { return null }
}
// Wolfx: EEW専用（JMA公式）
async function _fetchWolfx(): Promise<EqResult|null> {
  try {
    const resp = await fetch('https://api.wolfx.jp/jma_eew.json', { signal: AbortSignal.timeout(3000) })
    if (!resp.ok) return null
    const d = await resp.json() as any
    if (!d?.EventID || !d?.Hypocenter) return null
    const maxInt = typeof d.MaxIntensity === 'string' ? ({'1':10,'2':20,'3':30,'4':40,'5弱':45,'5強':50,'6弱':60,'6強':70,'7':80})[d.MaxIntensity] || -1 : -1
    const id = d.EventID + '-' + (d.Serial||'0')
    return { id, isEew: true, time: d.AnnouncedTime || '', type: '緊急地震速報', magnitude: d.Magunitude ?? null, depth: d.Depth != null ? d.Depth + 'km' : '', location: d.Hypocenter || '', maxScale: maxInt, scaleLabel: d.MaxIntensity || '', isNew: id !== _lastEqId, serious: true }
  } catch { return null }
}
// YDITS: EEW発生中かどうかのみ
async function _fetchYDITS(): Promise<EqResult|null> {
  try {
    const resp = await fetch('https://api.ydits.net/vxse43', { signal: AbortSignal.timeout(3000) })
    if (!resp.ok) return null
    const d = await resp.json() as any
    if (d?.status !== 'OK' || !d?.isEew) return null
    const id = 'ydits-' + (d.time || Date.now())
    return { id, isEew: true, time: d.time || '', type: '緊急地震速報（警報）', magnitude: null, depth: '', location: '', maxScale: -1, scaleLabel: '', isNew: id !== _lastEqId, serious: true }
  } catch { return null }
}
app.get('/api/earthquake/current', async (c) => {
  // テスト地震は長めにキャッシュ（全端末に届けるため5秒）
  if (_eqCache && _eqCache.data?.eq?.id?.startsWith?.('test-') && Date.now() - _eqCache.time < 5000) {
    const d = _eqCache.data
    d.eq.isNew = d.eq.id !== _lastEqId
    if (d.eq.id !== _lastEqId) _lastEqId = d.eq.id
    return c.json(d)
  }
  if (_eqCache && Date.now() - _eqCache.time < 500) return c.json(_eqCache.data)
  const result = await _eqRace()
  if (!result) return c.json({ eq: null })
  result.isNew = result.id !== _lastEqId
  if (result.id !== _lastEqId) _lastEqId = result.id
  _eqCache = { data: { eq: result }, time: Date.now() }
  return c.json({ eq: result })
})
app.post('/api/earthquake/test', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  _lastEqId = ''
  _eqCache = null
  const testEq = {
    id: 'test-' + Date.now(), isEew: body.type === 'eew', time: new Date().toISOString(),
    type: body.type === 'eew' ? '緊急地震速報（テスト）' : '地震情報（テスト）',
    magnitude: body.magnitude || 5.0, depth: body.depth || '10km',
    location: body.location || '埼玉県南部', maxScale: body.scale || 60,
    scaleLabel: SCALE_LABELS[body.scale || 60] || '6弱',
    isNew: true, serious: true
  }
  _eqCache = { data: { eq: testEq }, time: Date.now() }
  return c.json({ eq: testEq })
})

// ウェザーニュース現在天気（サーバープロキシ）
let _wnCache: { data: any; time: number } | null = null
const WN_ICONS: Record<string, string> = {'100':'☀️','101':'🌤','110':'⛅','200':'☁️','201':'☁️','202':'☁️','210':'🌤','211':'🌤','212':'🌤','300':'🌧','301':'🌧','302':'🌧','303':'🌧','304':'🌧','306':'🌧','308':'🌧','311':'🌧','313':'🌧','314':'🌧','400':'❄️','401':'❄️','402':'❄️','403':'❄️'}
const WN_LABELS: Record<string, string> = {'100':'快晴','101':'晴れ','110':'薄曇り','200':'曇り','201':'曇り','202':'曇り','210':'晴れ','211':'晴れ','212':'晴れ','300':'雨','301':'雨','302':'雨','303':'雨','304':'雨','306':'雨','308':'雨','311':'雨','313':'雨','314':'雨','400':'雪','401':'雪','402':'雪','403':'雪'}
app.get('/api/weather/wn', async (c) => {
  if (_wnCache && Date.now() - _wnCache.time < 120000) return c.json(_wnCache.data)
  try {
    const resp = await fetch('http://weathernews.jp/api/weather.cgi?slat=35.8397&slon=139.3912&langid=ja', { signal: AbortSignal.timeout(5000) })
    const xml = await resp.text()
    const g = (s: string) => { const m = xml.match(new RegExp('<' + s + '>([^<]+)</' + s + '>')); return m ? m[1].trim() : '' }
    const tempF = parseFloat(g('temperature'))
    const tempC = Math.round((tempF - 32) * 5 / 9)
    const humidity = parseInt(g('humidity')) || 0
    const icon = g('weathericon')
    const precipIn = parseFloat(g('precip'))
    const precipMm = Math.round(precipIn * 25.4 * 10) / 10
    const maxTemp = parseInt(g('max_temp')) || 0
    const minTemp = parseInt(g('min_temp')) || 0
    const result = {
      temperature: tempC, humidity, weather_code: icon, precipitation: precipMm,
      max_temp: maxTemp, min_temp: minTemp,
      weather_emoji: WN_ICONS[icon] || '☀️', weather_label: WN_LABELS[icon] || '',
      source: 'ウェザーニュース'
    }
    _wnCache = { data: result, time: Date.now() }
    return c.json(result)
  } catch {
    return c.json({ error: 'Weather News fetch failed' }, 502)
  }
})

// 天気予報API（埼玉県南部）
const WEATHER_CODES: Record<string, string> = {'100':'☀️','101':'☀️','110':'⛅','200':'☁️','201':'☁️','202':'☁️','210':'🌤','211':'🌤','212':'🌤','300':'🌧','301':'🌧','302':'🌧','303':'🌧','304':'🌧','306':'🌧','308':'🌧','311':'🌧','313':'🌧','314':'🌧','400':'❄️','401':'❄️','402':'❄️','403':'❄️'}
app.get('/api/weather/forecast', async (c) => {
  try {
    const resp = await fetch('https://www.jma.go.jp/bosai/forecast/data/forecast/110000.json', { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return c.json({ error: 'Failed' }, 500)
    const data = await resp.json() as any[]
    const result: any[] = []
    for (const report of data || []) {
      const ts1 = report?.timeSeries?.[0]
      const ts2 = report?.timeSeries?.[1]
      const ts3 = report?.timeSeries?.[2]
      const areaSouth = ts1?.areas?.find((a: any) => a.area?.code === '110010')
      const popSouth = ts2?.areas?.find((a: any) => a.area?.code === '110010')
      const tempArea = ts3?.areas?.[0]
      if (areaSouth && ts1?.timeDefines) {
        result.push({
          date: ts1.timeDefines[0],
          weather: (WEATHER_CODES[areaSouth.weatherCodes?.[0]] || '') + (areaSouth.weathers?.[0] || ''),
          weatherTomorrow: (WEATHER_CODES[areaSouth.weatherCodes?.[1]] || '') + (areaSouth.weathers?.[1] || ''),
          wind: areaSouth.winds?.[0] || '',
          windTomorrow: areaSouth.winds?.[1] || '',
          pops: (popSouth?.pops || []).slice(0, 4),
          temps: tempArea?.temps ? { today: tempArea.temps[0], tonight: tempArea.temps[1], tomorrow: tempArea.temps[2], tomorrowNight: tempArea.temps[3] } : null,
          publishingOffice: report.publishingOffice,
          reportDatetime: report.reportDatetime
        })
      }
    }
    return c.json({ forecasts: result })
  } catch { return c.json({ error: 'Failed' }, 500) }
})

const distDir = process.cwd() + '/dist'
app.use('/static/*', serveStatic({ root: distDir }))
app.use('/icons/*', serveStatic({ root: distDir }))
app.use('/sw.js', serveStatic({ path: distDir + '/sw.js' }))
app.use('/manifest.json', serveStatic({ path: distDir + '/manifest.json' }))

const indexHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>上中黒板</title>
  <meta name="theme-color" content="#2d6a4f">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  <link rel="icon" href="/icons/icon-192.png" type="image/png">
  <link rel="stylesheet" href="/static/tailwind-compiled.css?v=9">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/static/style.css?v=9">
</head>
<body class="bg-gray-100 text-gray-800 font-sans">

  <div id="login-screen" class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-green-800 via-green-600 to-teal-700">
  <div class="w-full max-w-md px-6">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-4">
        <i class="fas fa-chalkboard text-white text-4xl"></i>
      </div>
      <h1 class="text-3xl font-bold text-white">上中黒板</h1>
      <p class="text-green-200 mt-1 text-sm">上中生のための情報共有プラットフォーム</p>
    </div>
    <div class="bg-white rounded-2xl shadow-2xl p-8">
      <h2 class="text-xl font-bold text-gray-700 mb-6 text-center">ログイン</h2>
      <div id="login-error" class="hidden mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"></div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">ユーザー名 / 名前 / ログインID</label>
          <input id="login-username" type="text" placeholder="例：24101 / T001 / admin"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">パスワード</label>
          <input id="login-password" type="password" placeholder="パスワードを入力"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            onkeydown="if(event.key==='Enter')doLogin()">
        </div>
        <button onclick="doLogin()" class="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition shadow-lg mt-2">
          <i class="fas fa-sign-in-alt mr-2"></i>ログイン
        </button>
      </div>
      <div class="mt-4 text-center">
        <button onclick="showRegisterModal()" class="text-green-500 text-sm hover:underline">
          <i class="fas fa-user-plus mr-1"></i>新規登録（招待コードをお持ちの方）
        </button>
      </div>
      <div class="mt-2 text-center border-t pt-2">
        <button onclick="showInitForm()" class="text-gray-400 text-xs hover:underline">
          <i class="fas fa-cog mr-1"></i>初期管理者設定
        </button>
      </div>
    </div>
  </div>
</div>

<div id="setup-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
  <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
    <div class="text-center mb-6">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-3">
        <i class="fas fa-user-cog text-green-600 text-2xl"></i>
      </div>
      <h2 class="text-xl font-bold text-gray-800">初回設定</h2>
      <p class="text-gray-500 text-sm mt-1">基本情報を設定してください</p>
    </div>
    <div id="setup-form-container"></div>
      <button onclick="submitSetup()" class="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition mt-4">
      <i class="fas fa-check mr-2"></i>設定を完了する
    </button>
  </div>
</div>

<div id="register-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60">
  <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
    <h2 class="text-xl font-bold mb-4 text-center">新規登録</h2>
    <div id="register-error" class="hidden mb-3 p-2 bg-red-50 text-red-600 text-sm rounded-lg"></div>
    <div class="space-y-3">
      <input id="reg-token" type="text" placeholder="招待コード" class="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      <input id="reg-username" type="text" placeholder="ユーザー名" class="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      <input id="reg-password" type="password" placeholder="パスワード" class="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      <button onclick="doRegister()" class="w-full py-2 bg-green-600 text-white rounded-xl font-semibold text-sm">登録</button>
      <button onclick="hideRegisterModal()" class="w-full py-2 border border-gray-300 text-gray-600 rounded-xl text-sm">キャンセル</button>
    </div>
  </div>
</div>

<div id="init-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60">
  <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
    <h2 class="text-xl font-bold mb-4 text-center">初期管理者設定</h2>
    <p class="text-sm text-gray-500 mb-4 text-center">初回のみ管理者アカウントを作成できます</p>
    <div id="init-error" class="hidden mb-3 p-2 bg-red-50 text-red-600 text-sm rounded-lg"></div>
    <div class="space-y-3">
      <input id="init-username" type="text" placeholder="管理者ユーザー名" class="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      <input id="init-password" type="password" placeholder="パスワード" class="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      <button onclick="doInit()" class="w-full py-2 bg-green-600 text-white rounded-xl font-semibold text-sm">作成</button>
      <button onclick="hideInitModal()" class="w-full py-2 border border-gray-300 text-gray-600 rounded-xl text-sm">キャンセル</button>
    </div>
  </div>
</div>

<div id="app" class="hidden flex flex-col h-screen max-h-screen overflow-hidden">
<div id="info-bar" class="flex-none">
  <div id="disaster-bar" class="bg-orange-500 text-white text-xs py-1 px-3 flex items-center gap-2 overflow-hidden">
    <i class="fas fa-shield-alt flex-none"></i>
    <div class="overflow-hidden whitespace-nowrap flex-1">
      <span id="disaster-text">防災情報: 現在警報はありません</span>
    </div>
  </div>
  <div id="earthquake-bar" class="hidden bg-red-600 text-white text-sm py-2 px-3 flex items-center gap-3 overflow-hidden animate-pulse">
    <i class="fas fa-exclamation-triangle flex-none text-lg"></i>
    <div class="flex-1 overflow-hidden whitespace-nowrap">
      <span id="earthquake-text"></span>
    </div>
  </div>
  <div id="wbgt-bar" class="bg-teal-600 text-white text-xs py-1 px-3 flex items-center gap-2 overflow-hidden">
    <i class="fas fa-thermometer-half flex-none"></i>
    <div class="overflow-hidden whitespace-nowrap flex-1">
      <span id="wbgt-text">気象情報を取得中...</span>
    </div>
  </div>
</div>
  <header class="bg-gradient-to-r from-teal-800 to-green-700 text-white px-4 py-2.5 flex items-center gap-3 flex-none shadow-md">
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-lg flex-none">
        <i class="fas fa-chalkboard"></i>
      </div>
      <div class="min-w-0">
        <h1 class="font-bold text-base leading-tight truncate">上中黒板</h1>
        <span id="digital-clock" class="text-xs text-green-200 font-mono"></span>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button onclick="navigateTo('notifications')" class="relative p-1.5 rounded-full bg-transparent border-none outline-none">
        <i class="fas fa-bell text-lg text-red-500"></i>
        <span id="notif-badge" class="hidden absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">0</span>
      </button>
      <div id="header-avatar" class="w-7 h-7 rounded-full bg-green-400 flex items-center justify-center text-xs font-bold">
        <span>-</span>
      </div>
      <span id="header-name" class="text-sm font-medium hidden sm:block">-</span>
    </div>
  </header>
  <div id="tab-content" class="flex-1 overflow-y-auto"></div>
  <nav id="bottom-nav" class="flex-none bg-white border-t border-gray-200 shadow-lg z-30">
    <div id="nav-tabs" class="flex justify-around items-center py-1 overflow-x-auto"></div>
  </nav>
</div>

<div id="notif-panel" class="hidden fixed inset-0 z-40 bg-black/50" onclick="hideNotificationPanel()">
  <div class="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl" onclick="event.stopPropagation()">
    <div class="flex items-center justify-between p-4 border-b">
      <h3 class="font-bold text-gray-800">通知</h3>
      <button onclick="hideNotificationPanel()" class="p-2 hover:bg-gray-100 rounded-full text-gray-500"><i class="fas fa-times"></i></button>
    </div>
    <div id="notif-list" class="flex-1 overflow-y-auto p-2 space-y-2"></div>
  </div>
</div>

<div id="modal-overlay" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
  <div id="modal-box" class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
    <div class="flex items-center justify-between p-4 border-b">
      <h3 id="modal-title" class="text-lg font-bold text-gray-800"></h3>
      <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-full text-gray-500"><i class="fas fa-times"></i></button>
    </div>
    <div id="modal-body" class="flex-1 overflow-y-auto p-4"></div>
    <div id="modal-footer" class="p-4 border-t flex gap-2 justify-end"></div>
  </div>
</div>

<div id="toast-container" class="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none"></div>

<script src="/static/app.js?v=13"></script>
</body>
</html>`

app.get('*', async (c) => {
  const url = new URL(c.req.url)
  if (url.pathname.startsWith('/api/')) {
    return c.json({ error: 'Not found' }, 404)
  }
  return c.html(indexHtml)
})

export default app
