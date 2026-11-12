const CACHE = 'fitlog-v11';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png'
];

function put(req, res) {
  if (!res || !res.ok) return;
  const copy = res.clone();
  caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 策略�?// - 页面导航：先网络（拿到最�?HTML），失败再回缓存
// - 样式/脚本：先网络，失败回缓存
// - 图片等：先缓存，没有再网�?self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => { put(req, res.clone()); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const networkFirst = url.origin === self.location.origin && /\.(css|js|webmanifest)$/.test(url.pathname);
  if (networkFirst) {
    e.respondWith(
      fetch(req).then(res => { put(req, res.clone()); return res; })
        .catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => { put(req, res.clone()); return res; }).catch(() => caches.match('./index.html')))
  );
});
