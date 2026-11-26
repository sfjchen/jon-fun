/**
 * Sync identity API shared by every synced app (Daily Learn, Notes, Reader).
 * GET restores a browser's ids from its HttpOnly cookie after Safari's 7-day storage wipe.
 * POST ties the browser's device ID to its sync key on the server and refreshes the cookie.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { canonicalKey, getDevice, SYNC_COOKIE as COOKIE, SYNC_DEVICES_TABLE, type SyncDevice } from '@/lib/syncAccess'
import { DEVICE_KINDS, tidyName, type DeviceKind } from '@/lib/syncIdentity'
import { likeName } from '@/lib/results'

const MAX_AGE_S = 400 * 24 * 60 * 60
const ID_RE = /^[A-Za-z0-9-]{8,64}$/
const MAX_KEY = 200

/**
 * Returns the browser's saved ids from the cookie, or empty strings when missing or malformed.
 */
export async function GET(request: NextRequest) {
  try {
    const v = JSON.parse(request.cookies.get(COOKIE)?.value ?? '{}') as { syncKey?: unknown; deviceId?: unknown }
    const device = typeof v.deviceId === 'string' && ID_RE.test(v.deviceId) ? await getDevice(v.deviceId) : null
    return NextResponse.json(
      {
        syncKey: typeof v.syncKey === 'string' ? v.syncKey : '',
        deviceId: typeof v.deviceId === 'string' ? v.deviceId : '',
        ...(device?.player_name
          ? { player: { name: device.player_name, group: device.player_group || 'public' } }
          : {}),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return NextResponse.json({ syncKey: '', deviceId: '' })
  }
}

/**
 * Saves the device's kind and tags its earlier untagged daily results with it, so scores played before kinds were
 * recorded still split by device.
 */
async function tagKind(did: string, kind: DeviceKind) {
  await Promise.all([
    supabaseAdmin.from(SYNC_DEVICES_TABLE).update({ device_kind: kind }).eq('device_id', did),
    supabaseAdmin.from('game_results').update({ device_kind: kind }).eq('device_id', did).is('device_kind', null),
  ])
}

/**
 * Ties the device to its sync key on the server and refreshes the cookie. A device that arrives without a key
 * gets back the key it was tied to before, so wiped storage restores itself. Keyless devices store no row.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      syncKey?: string
      deviceId?: string
      label?: string
      kind?: string
      player?: { name?: string; group?: string }
    }
    const did = (body.deviceId ?? '').trim()
    if (!ID_RE.test(did) || (body.syncKey ?? '').length > MAX_KEY) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })
    }
    const prev = await getDevice(did)
    const key = canonicalKey(body.syncKey) || prev?.sync_key || ''
    if (
      body.player &&
      (typeof body.player.name !== 'string' ||
        !body.player.name.trim() ||
        body.player.name.length > 24 ||
        typeof body.player.group !== 'string' ||
        !/^[a-z0-9-]{3,32}$/.test(body.player.group))
    )
      return NextResponse.json({ error: 'Invalid player' }, { status: 400 })
    // A device still sending the name an admin renamed gets the new name back and adopts it.
    const renamed =
      !!body.player &&
      !!prev?.player_was &&
      !!prev.player_name &&
      body.player.name!.trim().toLowerCase() === prev.player_was.toLowerCase()
    const player = renamed
      ? { name: prev.player_name!, group: prev.player_group || 'public' }
      : body.player
        ? { name: tidyName(body.player.name!), group: body.player.group! }
        : prev?.player_name
          ? { name: prev.player_name, group: prev.player_group || 'public' }
          : undefined
    // A name already on the board keeps the board's spelling, so a device that typed "JON" plays as the "Jon" its
    // results sit under and sees them as its own.
    let respelled = false
    if (body.player && !renamed && player) {
      const { data } = await supabaseAdmin
        .from('game_results')
        .select('name')
        .eq('group_code', player.group)
        .ilike('name', likeName(player.name))
        .order('created_at')
        .limit(1)
      const board = data?.[0]?.name as string | undefined
      respelled = !!board && board !== player.name
      if (respelled) player.name = board!
    }
    const kind = DEVICE_KINDS.find((k) => k === body.kind)
    if (kind) await tagKind(did, kind)
    if (key || player) {
      const label = (body.label ?? '').trim().slice(0, 80) || prev?.label || ''
      const row: SyncDevice = {
        device_id: did,
        sync_key: key || null,
        label: player?.name || label,
        ...(kind ? { device_kind: kind } : {}),
        last_seen: new Date().toISOString(),
        ...(player ? { player_name: player.name, player_group: player.group } : {}),
        ...(body.player && !renamed && prev?.player_was ? { player_was: null } : {}),
      }
      const { error } = await supabaseAdmin.from(SYNC_DEVICES_TABLE).upsert(row, { onConflict: 'device_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const res = NextResponse.json(
      { syncKey: key, ...(player ? { player } : {}), ...(renamed || respelled ? { renamed: true } : {}) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
    res.cookies.set(COOKIE, JSON.stringify({ syncKey: key, deviceId: did }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/sync',
      maxAge: MAX_AGE_S,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
