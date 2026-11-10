/**
 * Sync identity API shared by every synced app (Daily Learn, Notes, Reader).
 * GET restores a browser's ids from its HttpOnly cookie after Safari's 7-day storage wipe.
 * POST links the browser's device ID to its sync key and refreshes the cookie.
 * PATCH lets an approved device approve or remove another device of the same key.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { NOTE_SESSIONS_TABLE } from '@/lib/notes/db'
import { canonicalKey, getDevice, SYNC_DEVICES_TABLE, type SyncDevice } from '@/lib/syncAccess'

const COOKIE = 'sfjc_ids'
const MAX_AGE_S = 400 * 24 * 60 * 60
const ID_RE = /^[A-Za-z0-9-]{8,64}$/
const MAX_KEY = 200

/**
 * Returns the browser's saved ids from the cookie, or empty strings when missing or malformed.
 */
export async function GET(request: NextRequest) {
  try {
    const v = JSON.parse(request.cookies.get(COOKIE)?.value ?? '{}') as { syncKey?: unknown; deviceId?: unknown }
    return NextResponse.json({
      syncKey: typeof v.syncKey === 'string' ? v.syncKey : '',
      deviceId: typeof v.deviceId === 'string' ? v.deviceId : '',
    })
  } catch {
    return NextResponse.json({ syncKey: '', deviceId: '' })
  }
}

/**
 * Reports whether a key is brand new: no approved device and no stored rows. Its first device is approved at
 * once, while a key that already holds data needs approval from one of its devices.
 */
async function isFreshKey(key: string): Promise<boolean> {
  const [devs, daily, notes] = await Promise.all([
    supabaseAdmin.from(SYNC_DEVICES_TABLE).select('device_id').eq('sync_key', key).eq('approved', true).limit(1),
    supabaseAdmin.from('daily_learn_entries').select('date').eq('user_id', key).limit(1),
    supabaseAdmin.from(NOTE_SESSIONS_TABLE).select('session_id').eq('user_id', key).limit(1),
  ])
  if (devs.error || daily.error || notes.error) return false
  return !devs.data?.length && !daily.data?.length && !notes.data?.length
}

/**
 * Lists every device linked to a key, newest activity first, for the approval UI.
 */
async function listDevices(key: string) {
  const { data } = await supabaseAdmin
    .from(SYNC_DEVICES_TABLE)
    .select('device_id, label, approved, last_seen')
    .eq('sync_key', key)
    .order('last_seen', { ascending: false })
  return (data ?? []).map((d) => ({ deviceId: d.device_id, label: d.label, approved: d.approved, lastSeen: d.last_seen }))
}

/**
 * Links the device to its sync key (a new key resets approval), refreshes the cookie, and returns the
 * canonical key, approval state and, for approved devices, the key's device list.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { syncKey?: string; deviceId?: string; label?: string }
    const did = (body.deviceId ?? '').trim()
    const key = canonicalKey(body.syncKey)
    if (!ID_RE.test(did) || key.length > MAX_KEY) return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })
    const prev = await getDevice(did)
    const label = (body.label ?? '').trim().slice(0, 80) || prev?.label || ''
    const approved = key ? (prev?.sync_key === key && prev.approved) || (await isFreshKey(key)) : false
    const row: Omit<SyncDevice, 'created_at'> = {
      device_id: did,
      sync_key: key || null,
      approved,
      label,
      last_seen: new Date().toISOString(),
    }
    const { error } = await supabaseAdmin.from(SYNC_DEVICES_TABLE).upsert(row, { onConflict: 'device_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const res = NextResponse.json({
      syncKey: key,
      approved,
      devices: approved ? await listDevices(key) : [],
    })
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

/**
 * Approves or removes another device of the caller's key. Only an approved device of that key may do this.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { deviceId?: string; target?: string; approve?: boolean }
    const me = await getDevice(body.deviceId)
    const target = await getDevice(body.target)
    if (!me?.approved || !me.sync_key || !target || target.sync_key !== me.sync_key) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }
    const patch = body.approve ? { approved: true } : { approved: false, sync_key: null }
    const { error } = await supabaseAdmin.from(SYNC_DEVICES_TABLE).update(patch).eq('device_id', target.device_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ devices: await listDevices(me.sync_key) })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
