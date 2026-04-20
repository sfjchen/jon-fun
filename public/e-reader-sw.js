const CACHE_NAME = 'sfjc-reader-shell-v2'
const FALLBACK_PATH = '/games/e-reader'

self.addEventListener('install', (event) => {
  // Never use cache.addAll with optional paths: one 404 fails the whole install.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(FALLBACK_PATH)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  const isLocalReaderPath =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/games/e-reader') || url.pathname.startsWith('/theme2/games/e-reader'))

  if (!isLocalReaderPath) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        return caches.match(FALLBACK_PATH)
      }),
  )
})
