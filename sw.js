// 极简 service worker：仅用于满足 PWA 安装条件 + 离线首屏兜底
// 策略：导航/同源资源走网络优先并缓存一份；跨域（Supabase、字体）直接透传。
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨域请求直接透传（Supabase / 字体 CDN）
  if (url.origin !== self.location.origin) return;

  // 同源：网络优先，失败回退缓存
  // cache:'no-cache' 强制每次都向服务器（/CDN）重新校验，绕开 GitHub Pages 的
  // max-age=600 缓存与浏览器 HTTP 缓存，确保每次都拿到最新 HTML/资源，
  // 彻底解决「手机 PWA 一直显示旧版、更新不生效」的问题。
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        const copy = res.clone();
        caches.open('wb-v39').then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
