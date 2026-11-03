// v20261103 离线可用版 service worker（本地模式配套）
// 设计要点：
// 1) 安装时缓存「app 外壳」：index.html / sw.js / manifest / 各尺寸图标（不含 supabase-js.js）。
//    —— 不含 supabase-js.js：离线时它加载失败 → supabase 未定义 → 自动本地模式；
//       联网时仍走网络取最新，避免缓存过期版本。
// 2) 导航请求（HTML）走「network-first + 离线回退缓存」：联网取最新并刷新缓存，断网用上次缓存，
//    保证页面断网也能打开。
// 3) 同源静态资源（图标 / manifest）走 cache-first，加速且离线可用。
// 4) 跨域请求（supabase.co 等）一律放行直连，SW 绝不拦截 → 不会再把 supabase-js.js 取坏、
//    也不会干扰云同步；本 SW 只管同源 app 外壳的离线能力。
// 5) activate 时只清掉非本版本的旧缓存，避免历史损坏缓存，并 claim 接管页面。
const CACHE = 'wb-shell-v2';
const SHELL = [
  './',
  'index.html',
  'sw.js',
  'manifest.json',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-512-flat.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try { await c.addAll(SHELL); } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (!req || req.method !== 'GET') return;            // 非 GET（含 Supabase 写操作）不处理
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // 跨域（supabase.co）直连，不拦截

  // 导航（HTML）：network-first，离线回退缓存
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, net.clone());
        return net;
      } catch (_) {
        const cached = await caches.match(req) || await caches.match('index.html') || await caches.match('./');
        return cached || Response.error();
      }
    })());
    return;
  }

  // 同源静态资源：cache-first
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, net.clone());
      return net;
    } catch (_) {
      return Response.error();
    }
  })());
});
