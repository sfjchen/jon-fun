'use client'

/*
 * Browser side of friend nudges: turns push notifications on or off for the player's board name and sends a nudge to
 * a friend. Push rides on the site service worker the e-reader already registers. iPhones support web push only for
 * sites added to the Home Screen, so `pushStatus` reports that case apart from browsers with no push at all.
 */
import { useEffect, useState } from 'react'
import { registerReaderServiceWorker } from '@/lib/reader/pwa'
import type { Player } from '@/lib/results'

export type PushStatus = 'loading' | 'unsupported' | 'install' | 'denied' | 'off' | 'on'
const CHANGED = 'sfjc-push-changed'

/**
 * Returns this browser's current push subscription, or null when push is unavailable or off.
 */
async function current(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await registerReaderServiceWorker()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/**
 * Files the subscription under the player's name, so nudges to that name reach this browser.
 */
async function save(sub: PushSubscription, player: Player): Promise<boolean> {
  const r = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group: player.group, name: player.name, subscription: sub.toJSON() }),
  })
  return r.ok
}

/**
 * Tracks whether nudges are on for this browser, and refiles the subscription when the player's name changes.
 */
export function usePushStatus(player: Player | null): PushStatus {
  const [status, setStatus] = useState<PushStatus>('loading')
  const key = player ? `${player.group}:${player.name}` : ''
  useEffect(() => {
    let live = true
    const check = async () => {
      const ios =
        /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
      const next: PushStatus =
        !('PushManager' in window) || !('Notification' in window)
          ? ios
            ? 'install'
            : 'unsupported'
          : Notification.permission === 'denied'
            ? 'denied'
            : (await current())
              ? 'on'
              : 'off'
      if (live) setStatus(next)
    }
    void check()
    window.addEventListener(CHANGED, check)
    return () => {
      live = false
      window.removeEventListener(CHANGED, check)
    }
  }, [])
  useEffect(() => {
    if (status !== 'on' || !player) return
    void current().then((s) => s && save(s, player))
    // Refiles only when the name or group changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, key])
  return status
}

/**
 * Asks for notification permission (call from a tap) and subscribes this browser for the player's nudges. Returns
 * an error message, or '' on success.
 */
export async function enableNudges(player: Player): Promise<string> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!pub) return 'Nudges are not set up yet.'
  if ((await Notification.requestPermission()) !== 'granted') {
    window.dispatchEvent(new Event(CHANGED))
    return 'Notifications are blocked for this site.'
  }
  const reg = await registerReaderServiceWorker()
  if (!reg) return 'This browser cannot receive nudges.'
  await navigator.serviceWorker.ready
  const raw = atob(pub.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (pub.length % 4)) % 4))
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      }))
    const ok = await save(sub, player)
    window.dispatchEvent(new Event(CHANGED))
    return ok ? '' : 'Could not turn on nudges. Try again.'
  } catch {
    return 'Could not turn on nudges. Try again.'
  }
}

/**
 * Unsubscribes this browser and removes it from the server.
 */
export async function disableNudges(): Promise<void> {
  const sub = await current()
  if (sub) {
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {})
    await sub.unsubscribe()
  }
  window.dispatchEvent(new Event(CHANGED))
}

/**
 * Nudges a friend, returning '' once it reaches at least 1 of their browsers, or the reason it did not.
 */
export async function nudge(player: Player, to: string): Promise<string> {
  const r = await fetch('/api/push/nudge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group: player.group, from: player.name, to }),
  }).catch(() => null)
  if (!r) return 'Offline'
  const d = (await r.json().catch(() => ({}))) as { error?: string; delivered?: number }
  if (r.status === 409) return ''
  if (!r.ok) return d.error ?? 'Could not nudge'
  return d.delivered ? '' : `${to} has not turned on nudges yet`
}
