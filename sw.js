// 极简 service worker：满足 PWA 安装条件 + 离线首屏兜底
// v20261014-1600 缓存策略调整：
//  - 稳定静态资源（supabase-js.js / icon-* / manifest / favicon）走【缓存优先】，
//    避免每次打开都重新下载 212KB 的 supabase-js.js，显著加快手机端启动与首次云端拉取。
//  - 动态资源（index.html / sw.js）仍走【网络优先 + 强制校验】，
//    保证每次部署手机端打开都能拿到最新页面，更新即时生效。
//  - activate 时清理旧缓存（只保留 wb-v40），避免缓存堆积与陈旧资源。
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  await self.clients.claim();
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== 'wb-v40').map(k => caches.delete(k)));
})()));

// 稳定静态资源清单（路径末尾匹配，忽略查询串）
const STATIC_RE = /\/(supabase-js\.js|icon-192\.png|icon-512\.png|manifest\.json|favicon\.ico)(\?.*)?$/;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨域请求直接透传（Supabase / 字体 CDN），不缓存
  if (url.origin !== self.location.origin) return;

  // 稳定静态资源：缓存优先，未命中再网络并回填
  if (STATIC_RE.test(url.pathname)) {
    e.respondWith(
      caches.open('wb-v40').then(c => c.match(req)).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.ok) { const cp = res.clone(); c.put(req, cp).catch(() => {}); }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 动态资源（index.html / sw.js）：网络优先 + 强制校验，确保最新；失败回退缓存
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        const copy = res.clone();
        caches.open('wb-v40').then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
