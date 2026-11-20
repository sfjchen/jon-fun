// Site service worker: caches the e-reader shell for offline reading and shows friend-nudge notifications.
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
    (url.pathname.startsWith('/games/e-reader'))

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

// Friend nudges: shows the pushed notification, and a tap focuses an open sfjc.dev tab or opens the Daily drawer.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'sfjc.dev', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'nudge',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      const tab = tabs.find((t) => new URL(t.url).origin === self.location.origin)
      return tab ? tab.focus().then((t) => t.navigate(url)) : self.clients.openWindow(url)
    }),
  )
})
