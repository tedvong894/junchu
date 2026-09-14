// 极简 service worker：仅用于满足 PWA 安装条件 + 离线首屏兜底
// 策略：同源 GET 走「网络优先」，仅当响应为 2xx 才写入缓存；
//       若服务器返回 403/5xx 或断网，则不缓存错误页，并尽量回退到上一份正常缓存。
const CACHE = 'wb-v5';
const PRECACHE = ['./', './index.html', './sw.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}) ) );
});

self.addEventListener('activate', e => {
  // 清掉旧版本缓存（含可能被旧逻辑污染过的 403 错误页）
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨域请求直接透传（Supabase / 字体 CDN）
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        // 关键修复：只有成功响应（2xx）才进缓存，绝不缓存 403/5xx 错误页
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))   // 断网时回退缓存
  );
});
