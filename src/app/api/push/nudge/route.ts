/**
 * Friend nudges. POST sends a nudge as a push notification to every browser subscribed under the friend's name, so
 * all of their devices get it. Each sender can nudge a friend once per day and at most 20 friends per day. GET lists
 * who the sender already nudged today and which players on the board can receive nudges.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { siteDay } from '@/lib/daily'
import { pushReady, pushTo } from '@/lib/push-server'
import { likeName } from '@/lib/results'
import { supabaseAdmin } from '@/lib/supabase'

const name = z.string().trim().min(1).max(24)
const group = z.string().regex(/^[a-z0-9-]{3,32}$/)
const body = z.object({ group, from: name, to: name })

/**
 * Returns the lowercased names the sender nudged today and the lowercased names with at least 1 subscribed browser.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const p = z.object({ group, from: name }).safeParse({ group: q.get('group'), from: q.get('from') })
  if (!p.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const [sent, subs] = await Promise.all([
    supabaseAdmin
      .from('nudges')
      .select('to_name')
      .eq('group_code', p.data.group)
      .eq('from_name', p.data.from.toLowerCase())
      .eq('day', siteDay()),
    supabaseAdmin.from('push_subscriptions').select('name').eq('group_code', p.data.group),
  ])
  if (sent.error || subs.error) return NextResponse.json({ error: 'Could not load nudges' }, { status: 503 })
  return NextResponse.json(
    { nudged: sent.data.map((r) => r.to_name), reachable: [...new Set(subs.data.map((r) => r.name.toLowerCase()))] },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/**
 * Pushes the nudge and records it. Returns how many browsers received it, or 409 when already nudged today. A
 * friend with no subscribed browser is not recorded, so the nudge can be sent once they turn nudges on.
 */
export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: 'Invalid nudge' }, { status: 400 })
  if (!pushReady()) return NextResponse.json({ error: 'Nudges are not set up' }, { status: 503 })
  const { group, from, to } = p.data,
    day = siteDay()
  if (from.toLowerCase() === to.toLowerCase())
    return NextResponse.json({ error: 'You cannot nudge yourself' }, { status: 400 })
  const subs = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth')
    .eq('group_code', group)
    .ilike('name', likeName(to))
  if (subs.error) return NextResponse.json({ error: 'Could not send nudge' }, { status: 503 })
  if (!subs.data.length) return NextResponse.json({ ok: true, delivered: 0 })
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
  // Each sender has its own tag, so a second friend's nudge alerts again instead of silently replacing the first.
  const delivered = await pushTo(subs.data, {
    title: `${from} nudged you`,
    body: "Today's daily games are waiting.",
    url: '/?daily=1',
    tag: `nudge:${from.toLowerCase()}`,
  })
  // A nudge no push service accepted is taken back, so the sender can try again.
  if (!delivered) await supabaseAdmin.from('nudges').delete().match(row)
  return NextResponse.json({ ok: true, delivered })
}
