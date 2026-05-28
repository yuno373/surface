import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
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

type Env = { DB: any; R2: any; VAPID_PUBLIC_KEY?: string }
const app = new Hono<{ Bindings: Env }>()
let db: any, r2: any
try { db = createD1Client(); r2 = createR2Client() } catch {}

app.use('*', async (c, next) => {
  if (!db) try { db = createD1Client() } catch {}
  if (!r2) try { r2 = createR2Client() } catch {}
  c.env = { ...c.env, DB: db, R2: r2 }
  await next()
})

app.use('/api/*', cors({ origin: '*', credentials: true }))
app.use('*', secureHeaders())

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

app.get('/api/wbgt', async (c) => {
  try {
    const resp = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&current=temperature_2m,relative_humidity_2m',
      { signal: AbortSignal.timeout(5000) }
    )
    if (resp.ok) {
      const data = await resp.json() as any
      const ta = data?.current?.temperature_2m
      const rh = data?.current?.relative_humidity_2m
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
        return c.json({ wbgt: Math.round(wbgt * 10) / 10, level, alert, temp: ta, humidity: rh })
      }
    }
  } catch {}
  return c.json({ wbgt: null, level: null, alert: null })
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
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/static/style.css">
</head>
<body class="bg-gray-100 text-gray-800 font-sans">

  <div id="login-screen" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-green-800 via-green-600 to-teal-700">
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
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
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
      <button onclick="navigateTo('notifications')" class="relative p-1.5 hover:bg-white/10 rounded-full">
        <i class="fas fa-bell text-lg"></i>
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

<script src="/static/app.js?v=3"></script>
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
