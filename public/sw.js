const CACHE = 'sf-orders-v2'

// Cache the app shell on install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(['/', '/index.html', '/manifest.json', '/icon-192.png']).catch(() => {})
    })
  )
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
  // Only handle GET requests, skip Supabase API calls and backend /api/ endpoints
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
      .catch(async () => {
        // Try exact request match first
        const matched = await caches.match(e.request)
        if (matched) return matched

        // For navigation (HTML page requests like /login, /orders, etc.), return the cached SPA shell
        if (e.request.mode === 'navigate') {
          const shell = await caches.match('/index.html') || await caches.match('/')
          if (shell) return shell
        }

        // Always guarantee a valid Response object to prevent "TypeError: Failed to convert value to 'Response'"
        return new Response('Network error occurred. Please check your connection.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      })
  )
})
