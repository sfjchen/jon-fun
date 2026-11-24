/**
 * Admin changes to a board's players: renames a player or removes one with all their results. Only a device whose
 * saved player name is the admin name may call it. The device is read from the HttpOnly sync cookie, so the caller
 * cannot name another device.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimited } from '@/lib/api-guards'
import { ADMIN_NAME, likeName } from '@/lib/results'
import { getDevice, SYNC_COOKIE, SYNC_DEVICES_TABLE } from '@/lib/syncAccess'
import { supabaseAdmin } from '@/lib/supabase'

const name = z.string().trim().min(1).max(24)
const body = z.object({
  action: z.enum(['rename', 'remove']),
  group: z.string().regex(/^[a-z0-9-]{3,32}$/),
  name,
  to: name.optional(),
})

/**
 * Renames or removes the player on the caller's board. A rename moves the player's results, nudge subscriptions and
 * nudges to the new name and marks their devices, which adopt it on their next visit. A remove deletes the same
 * rows and leaves the devices alone, so the player starts over if they play again.
 */
export async function POST(req: NextRequest) {
  if (rateLimited(req, 'players', 30)) return NextResponse.json({ error: 'Too many changes' }, { status: 429 })
  const p = body.safeParse(await req.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: 'Invalid change' }, { status: 400 })
  let deviceId = ''
  try {
    deviceId = String((JSON.parse(req.cookies.get(SYNC_COOKIE)?.value ?? '{}') as { deviceId?: unknown }).deviceId)
  } catch {}
  const device = await getDevice(deviceId)
  const { action, group } = p.data
  if (device?.player_name?.trim().toLowerCase() !== ADMIN_NAME || (device.player_group || 'public') !== group)
    return NextResponse.json({ error: 'Only an admin device can change players' }, { status: 403 })
  const old = p.data.name.replace(/\s+/g, ' '),
    like = likeName(old),
    lower = old.toLowerCase()
  const rows = () => supabaseAdmin.from('game_results').select('name', { count: 'exact', head: true })
  const nudges = () =>
    (['from_name', 'to_name'] as const).map((col) =>
      supabaseAdmin.from('nudges').delete().eq('group_code', group).eq(col, lower),
    )
  const failed = () => NextResponse.json({ error: 'Could not change this player' }, { status: 503 })
  if (action === 'remove') {
    const done = await Promise.all([
      supabaseAdmin.from('game_results').delete({ count: 'exact' }).eq('group_code', group).ilike('name', like),
      supabaseAdmin.from('push_subscriptions').delete().eq('group_code', group).ilike('name', like),
      ...nudges(),
    ])
    if (done.some((d) => d.error)) return failed()
    return NextResponse.json({ ok: true, removed: done[0].count ?? 0 })
  }
  const to = p.data.to?.replace(/\s+/g, ' ')
  if (!to || to === old) return NextResponse.json({ error: 'Enter a new name' }, { status: 400 })
  // Another player's name is refused. A change of spelling or case of the same name is not another player.
  if (to.toLowerCase() !== lower) {
    const taken = await rows().eq('group_code', group).ilike('name', likeName(to))
    if (taken.error) return failed()
    if (taken.count) return NextResponse.json({ error: `${to} is already on this board` }, { status: 409 })
  }
  const moved = await supabaseAdmin
    .from('game_results')
    .update({ name: to }, { count: 'exact' })
    .eq('group_code', group)
    .ilike('name', like)
  if (moved.error) return failed()
  const rest = await Promise.all([
    supabaseAdmin.from('push_subscriptions').update({ name: to }).eq('group_code', group).ilike('name', like),
    supabaseAdmin
      .from(SYNC_DEVICES_TABLE)
      .update({ player_name: to, label: to, player_was: old })
      .eq('player_group', group)
      .ilike('player_name', like),
    // Nudges are keyed by both names and day, so they are dropped instead of renamed into a possible duplicate.
    ...nudges(),
  ])
  if (rest.some((d) => d.error)) return failed()
  return NextResponse.json({ ok: true, renamed: moved.count ?? 0, name: to })
}
