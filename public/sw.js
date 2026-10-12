const CACHE = 'sf-orders-v1'

// Cache the app shell on install
self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Clear old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first strategy: always try network, fall back to cache
self.addEventListener('fetch', e => {
  // Only handle GET requests, skip Supabase API calls
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('supabase.co') || e.request.url.includes('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE).then(cache => cache.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
