import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// Thiếu 2 dòng dưới là lý do PWA cứ phục vụ mãi bản JS/CSS cũ dù server đã deploy bản
// mới: mặc định 1 SW mới cài xong sẽ nằm "waiting" tới khi user đóng HẾT tab đang mở mới
// activate. skipWaiting() bỏ qua bước chờ đó; clientsClaim() cho SW mới nắm luôn các tab
// đang mở thay vì đợi lần load kế tiếp. Xem thêm registerServiceWorker() trong App.jsx.
self.skipWaiting();
clientsClaim();

// Precache SPA shell (JS/CSS/HTML đã hash theo build của Vite) để app cài đặt được và tải
// lại được khi offline. KHÔNG cache /api/* ở đây — dữ liệu duyệt bài/quyền hạn không nên
// phục vụ offline-stale (xem vite.config.js, chỉ dùng injectManifest, không runtime caching).
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  if (!event.data) return;
 
  const data  = event.data.json();
  const title = data.title || 'Quản Lý Tin';
  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/logo192.png',
    badge:   '/logo192.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/news' },
    actions: [
      { action: 'open',    title: '📄 Xem ngay' },
      { action: 'dismiss', title: '✕ Đóng'      }
    ]
  };
 
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
 
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
 
  if (event.action === 'dismiss') return;
 
  const url = event.notification.data?.url || '/news';
 
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Nếu app đang mở → focus và điều hướng
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // App chưa mở → mở tab mới
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});