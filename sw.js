// 极简 service worker：仅满足 PWA 安装条件 + 接管页面（claim），【不拦截任何请求】。
// v20261014-1604 改为「零拦截」：移除 fetch 处理器，所有资源（含 apple-touch-icon /
// manifest / supabase-js.js）都走浏览器原生直连。原因：iOS「添加到主屏幕」取图标 /
// manifest 时若经过 SW，SW 取图出错会让 iOS 回退成字母图标、或 iOS 按 URL 顽固缓存旧图标；
// 直连是最稳的取图路径，也彻底排除 SW 把 supabase-js.js 取坏导致「未开启云同步」的可能。
// 离线兜底能力因此关闭（用户主诉是图标+同步，非离线；如需离线可后续单独加）。
// activate 时清空本站点全部 Cache Storage，清掉历史可能损坏/过期的缓存。
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  await self.clients.claim();
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
})()));
