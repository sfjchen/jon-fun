/**
 * Sends a friend nudge as a push notification to every browser subscribed under the friend's name. Each sender can
 * nudge a friend once per day and at most 20 friends per day. Expired subscriptions are removed as they fail.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNotification, setVapidDetails, WebPushError } from 'web-push'
import { siteDay } from '@/lib/daily'
import { supabaseAdmin } from '@/lib/supabase'

const name = z.string().trim().min(1).max(24)
const body = z.object({ group: z.string().regex(/^[a-z0-9-]{3,32}$/), from: name, to: name })

/**
 * Records the nudge, then pushes it. Returns how many browsers received it, or 409 when already nudged today.
 */
export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: 'Invalid nudge' }, { status: 400 })
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return NextResponse.json({ error: 'Nudges are not set up' }, { status: 503 })
  const { group, from, to } = p.data,
    day = siteDay()
  if (from.toLowerCase() === to.toLowerCase())
    return NextResponse.json({ error: 'You cannot nudge yourself' }, { status: 400 })
  const sent = await supabaseAdmin
    .from('nudges')
    .select('to_name', { count: 'exact', head: true })
    .eq('group_code', group)
    .eq('from_name', from.toLowerCase())
    .eq('day', day)
  if ((sent.count ?? 0) >= 20) return NextResponse.json({ error: 'Nudge limit reached for today' }, { status: 429 })
  const row = { group_code: group, from_name: from.toLowerCase(), to_name: to.toLowerCase(), day }
  const ins = await supabaseAdmin.from('nudges').insert(row)
  if (ins.error?.code === '23505') return NextResponse.json({ error: 'Already nudged today' }, { status: 409 })
  if (ins.error) return NextResponse.json({ error: 'Could not send nudge' }, { status: 503 })
  const subs = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth')
    .eq('group_code', group)
    .ilike('name', to.replace(/[\\%_]/g, '\\$&'))
  if (subs.error) return NextResponse.json({ error: 'Could not send nudge' }, { status: 503 })
  setVapidDetails('https://sfjc.dev', pub, priv)
  const payload = JSON.stringify({
    title: `${from} nudged you`,
    body: "Today's daily games are waiting.",
    url: '/?daily=1',
  })
  const results = await Promise.all(
    subs.data.map((s) =>
      sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 43200 })
        .then(() => true)
        .catch(async (e: unknown) => {
          // A gone or unknown endpoint never comes back, so it is removed.
          if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410))
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          return false
        }),
    ),
  )
  return NextResponse.json({ ok: true, delivered: results.filter(Boolean).length })
}
