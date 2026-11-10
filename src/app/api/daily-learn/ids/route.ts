/**
 * 1 Sentence Everyday identity backup.
 * Mirrors the sync password and device ID into a server-set HttpOnly cookie, which Safari does not erase after
 * 7 days without a visit the way it erases localStorage, so a returning browser can restore its identity
 * instead of silently starting a new, unsynced device ID.
 */
import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'dl_ids'
const MAX_AGE_S = 400 * 24 * 60 * 60
const MAX_LEN = 200

type Ids = { syncKey: string; deviceId: string }

/**
 * Reads the stored ids from the request cookie, returning empty strings when it is missing or malformed.
 */
function readIds(request: NextRequest): Ids {
  try {
    const v = JSON.parse(request.cookies.get(COOKIE)?.value ?? '{}') as Partial<Ids>
    return {
      syncKey: typeof v.syncKey === 'string' ? v.syncKey : '',
      deviceId: typeof v.deviceId === 'string' ? v.deviceId : '',
    }
  } catch {
    return { syncKey: '', deviceId: '' }
  }
}

/** Returns the ids this browser saved earlier. */
export async function GET(request: NextRequest) {
  return NextResponse.json(readIds(request))
}

/** Saves the browser's current sync password and device ID for 400 days. */
export async function POST(request: NextRequest) {
  try {
    const { syncKey, deviceId } = (await request.json()) as Partial<Ids>
    const ids = { syncKey: (syncKey ?? '').trim(), deviceId: (deviceId ?? '').trim() }
    if (!ids.deviceId || ids.syncKey.length > MAX_LEN || ids.deviceId.length > MAX_LEN) {
      return NextResponse.json({ error: 'deviceId required' }, { status: 400 })
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE, JSON.stringify(ids), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/daily-learn',
      maxAge: MAX_AGE_S,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
