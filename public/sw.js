// ChoreSync Service Worker — push notifications + offline cache + background sync

const CACHE_NAME = 'choresync-v1'
const PRECACHE = ['/', '/chores', '/dashboard', '/icon-192.png']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Network-first for API/supabase, cache-first for everything else
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return
  if (e.request.method !== 'GET') return
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => cached)
      return cached ?? fetchPromise
    })
  )
})

// Background sync for queued chore completions
self.addEventListener('sync', e => {
  if (e.tag === 'sync-completions') {
    e.waitUntil(flushQueue())
  }
})

async function flushQueue() {
  // Notify all clients to flush their queue
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  clients.forEach(c => c.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' }))
}

// ── Push notifications (keep existing logic) ────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return
  let data
  try { data = e.data.json() } catch { data = { title: 'ChoreSync', body: e.data.text() } }
  const { title = 'ChoreSync', body = '', icon, badge, tag, url } = data
  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon: icon ?? '/icon-192.png', badge: badge ?? '/icon-192.png',
      tag: tag ?? 'choresync', data: { url: url ?? '/' }, requireInteraction: false,
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
