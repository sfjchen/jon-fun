let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

export function registerReaderServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register('/e-reader-sw.js').catch(() => null)
  }

  return registrationPromise
}
