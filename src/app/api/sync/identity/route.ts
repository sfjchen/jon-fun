/**
 * Sync identity API shared by every synced app (Daily Learn, Notes, Reader).
 * GET restores a browser's ids from its HttpOnly cookie after Safari's 7-day storage wipe.
 * POST ties the browser's device ID to its sync key on the server and refreshes the cookie.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
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
 * Ties the device to its sync key on the server and refreshes the cookie. A device that arrives without a key
 * gets back the key it was tied to before, so wiped storage restores itself. Keyless devices store no row.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { syncKey?: string; deviceId?: string; label?: string }
    const did = (body.deviceId ?? '').trim()
    if (!ID_RE.test(did) || (body.syncKey ?? '').length > MAX_KEY) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })
    }
    const prev = await getDevice(did)
    const key = canonicalKey(body.syncKey) || prev?.sync_key || ''
    if (key) {
      const label = (body.label ?? '').trim().slice(0, 80) || prev?.label || ''
      const row: SyncDevice = { device_id: did, sync_key: key, label, last_seen: new Date().toISOString() }
      const { error } = await supabaseAdmin.from(SYNC_DEVICES_TABLE).upsert(row, { onConflict: 'device_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const res = NextResponse.json({ syncKey: key })
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
