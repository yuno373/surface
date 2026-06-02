/* 上中黒板 Service Worker v2 - PWA */
const CACHE_NAME = 'jochu-kokuban-v6';
const STATIC_ASSETS = [
  '/',
  '/static/app.js?v=3',
  '/static/style.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-72.png',
];

// インストール
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// アクティベート
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// フェッチ（キャッシュファースト for static、ネットワークファースト for API）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // APIリクエストはネットワーク優先
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'オフライン' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }
  
  // 静的アセットはキャッシュ優先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/');
        }
      });
    })
  );
});

// プッシュ通知受信
self.addEventListener('push', (event) => {
  let data = { title: '上中黒板', body: '新しい通知があります', type: 'normal' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.type || 'normal',
    data: { url: '/' },
    requireInteraction: data.type === 'disaster',
    vibrate: data.type === 'disaster' ? [300, 100, 300, 100, 300] : [200, 100],
    actions: [
      { action: 'open', title: '開く' },
      { action: 'close', title: '閉じる' }
    ]
  };

  // 防災情報は緊急スタイル
  if (data.type === 'disaster') {
    options.badge = '/icons/disaster-badge.png';
    options.renotify = true;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 通知クリック
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// バックグラウンド同期
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // バックグラウンドでデータを同期
}
