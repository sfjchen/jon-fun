/**
 * Server side of push notifications: sends 1 payload to a list of browser subscriptions and removes the ones the
 * push service reports as gone. Shared by friend nudges and the confirmation a browser gets when it turns them on.
 */
import { sendNotification, setVapidDetails, WebPushError } from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

export type PushSub = { endpoint: string; p256dh: string; auth: string }
export type PushPayload = { title: string; body: string; url: string; tag: string }

/**
 * Reports whether the push keys are configured.
 */
export function pushReady(): boolean {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY
}

/**
 * Pushes the payload to every subscription and returns how many the push services accepted. High urgency asks
 * phones to deliver at once instead of batching, and the push service holds a message for 12 hours while a device
 * is off or its browser is closed.
 */
export async function pushTo(subs: PushSub[], payload: PushPayload): Promise<number> {
  if (!subs.length) return 0
  setVapidDetails('https://sfjc.dev', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  const sent = await Promise.all(
    subs.map((s) =>
      sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
        TTL: 43200,
        urgency: 'high',
      })
        .then(() => true)
        .catch(async (e: unknown) => {
          // A gone or unknown endpoint never comes back, so it is removed.
          if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410))
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          return false
        }),
    ),
  )
  return sent.filter(Boolean).length
}
