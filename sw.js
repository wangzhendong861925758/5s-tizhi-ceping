// ============================================
// PWA Service Worker（管理端）
// 策略：网络优先，离线时回退缓存
// - 在线时永远返回最新资源（与无 SW 时行为完全一致）
// - 仅当网络完全失败时才使用缓存的副本兜底
// - API 请求（/api/*）从不拦截、从不缓存，保证数据实时
// ============================================

const CACHE_NAME = 'admin-cache-v1';

// 安装后立即激活，不等待旧标签页关闭
self.addEventListener('install', () => {
  self.skipWaiting();
});

// 激活时清理旧版本缓存并立即接管页面
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只处理同源 GET 请求；其余（POST/跨域字体等）直接走浏览器默认行为
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API 请求不拦截，保证登录/凭证验证/数据读写永远实时
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 网络成功：后台复制一份进缓存（仅供离线兜底）
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(req, clone))
            .catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // 网络失败（离线）：回退到缓存副本
        caches.match(req).then((cached) => cached || Response.error())
      )
  );
});
