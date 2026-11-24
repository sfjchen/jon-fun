/**
 * Saves or removes this browser's push subscription for friend nudges. POST files the subscription under the board
 * name it plays as (a later POST from the same browser moves it to a new name) and confirms a new one with a
 * notification on that browser. DELETE removes it.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { pushReady, pushTo } from '@/lib/push-server'
import { supabaseAdmin } from '@/lib/supabase'

const sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
})
const body = z.object({
  group: z.string().regex(/^[a-z0-9-]{3,32}$/),
  name: z.string().trim().min(1).max(24),
  subscription: sub,
})

/**
 * Upserts the subscription for the player's name and group.
 */
export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  const { group, name, subscription: s } = p.data
  const known = await supabaseAdmin.from('push_subscriptions').select('endpoint').eq('endpoint', s.endpoint)
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    {
      endpoint: s.endpoint,
      group_code: group,
      name: name.replace(/\s+/g, ' '),
      p256dh: s.keys.p256dh,
      auth: s.keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 503 })
  // A browser that just turned nudges on gets 1 notification, which shows the player that this device receives them.
  if (!known.data?.length && pushReady())
    await pushTo([{ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }], {
      title: 'Nudges are on',
      body: `This device now gets nudges for ${name}.`,
      url: '/?daily=1',
      tag: 'nudges-on',
    })
  return NextResponse.json({ ok: true })
}

/**
 * Removes the subscription with the given endpoint.
 */
export async function DELETE(req: Request) {
  const p = z.object({ endpoint: z.string().url().max(1000) }).safeParse(await req.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', p.data.endpoint)
  return NextResponse.json({ ok: true })
}
