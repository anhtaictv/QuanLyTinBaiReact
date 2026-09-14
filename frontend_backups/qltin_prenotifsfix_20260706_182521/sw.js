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