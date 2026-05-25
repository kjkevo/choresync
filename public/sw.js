// ChoreSync Service Worker — handles Web Push notifications

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', e => {
  if (!e.data) return
  let data
  try { data = e.data.json() } catch { data = { title: 'ChoreSync', body: e.data.text() } }

  const { title = 'ChoreSync', body = '', icon, badge, tag, url } = data

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  icon  ?? '/icon-192.png',
      badge: badge ?? '/icon-192.png',
      tag:   tag   ?? 'choresync',
      data:  { url: url ?? '/' },
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url ?? '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})
