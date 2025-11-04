self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clients claim ensures the SW starts controlling open pages immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'New Message', body: 'You have a new notification' };
  }
  const title = data.title || 'New Message';
  const body = data.body || 'You received a new message';
  const icon = data.icon || '/icons/icon-192.png';
  const badge = data.badge || '/icons/badge-72.png';
  const tag = data.tag || 'chat-message';
  const dataPayload = data.data || {};

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: dataPayload
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
