// 极简 service worker：满足 PWA 安装条件 + 离线首屏兜底
// v20261014-1601 回滚缓存策略（修复 v1600 引入的回归）：
//   v1600 对静态资源改「缓存优先」，在缓存未命中且网络取回失败时返回空响应，
//   导致 supabase-js.js 加载失败（supabase 未定义 → 点击刷新显示「未开启云同步」），
//   同时 apple-touch-icon 也被取坏 → iOS 回退成默认文字图标。二者同源。
//   现恢复为「网络优先 + 失败回退缓存」（v1545 已验证可用）：每次向服务器校验
//   （GitHub Pages 未变时返回 304、不传 body，几乎无耗时），网络异常才用缓存兜底，
//   绝不会返回空响应。激活时清理 wb-v41 之外全部缓存，确保旧的可能损坏的缓存被清掉。
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  await self.clients.claim();
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== 'wb-v41').map(k => caches.delete(k)));
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨域请求直接透传（Supabase / 字体 CDN），不缓存
  if (url.origin !== self.location.origin) return;

  // 同源：网络优先（强制校验，保证打开即更新），失败回退缓存；绝不返回空响应
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        const copy = res.clone();
        caches.open('wb-v41').then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
