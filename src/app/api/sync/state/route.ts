/**
 * Device state mirror API. Keeps each sync account's copy of the browser-only state (game runs, reader progress
 * and annotations, personal bests), so it follows the account to every device.
 * POST returns the entries saved since the caller's cursor, then stores the entries it sent that are newer than
 * the stored ones.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveSyncUser } from '@/lib/syncAccess'
import { isSyncedKey, MAX_BATCH, MAX_VALUE, type StateEntry } from '@/lib/stateSync'

const TABLE = 'account_state'
const PAGE = 300
const MAX_REPLY = 3_000_000

/**
 * Pages through the account's entries saved after `since` and stores the sent entries whose edit is newer.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; since?: string; entries?: StateEntry[] }
    const who = resolveSyncUser(body.userId)
    if ('error' in who) return NextResponse.json({ error: who.error }, { status: who.status })
    const since = Number.isFinite(Date.parse(body.since ?? '')) ? body.since! : new Date(0).toISOString()
    const { data: rows, error } = await supabaseAdmin
      .from(TABLE)
      .select('key, value, updated_at, saved_at')
      .eq('user_id', who.uid)
      .gt('saved_at', since)
      .order('saved_at')
      .limit(PAGE)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // A reply stops at about 3 MB, and the caller asks again from the last entry it got.
    let size = 0
    const page = (rows ?? []).filter((r, i) => (size += (r.value as string).length) <= MAX_REPLY || i === 0)

    const now = Date.now()
    const sent = (Array.isArray(body.entries) ? body.entries : [])
      .filter(
        (e) =>
          e &&
          typeof e.key === 'string' &&
          isSyncedKey(e.key) &&
          typeof e.value === 'string' &&
          e.value.length <= MAX_VALUE &&
          Number.isFinite(e.at),
      )
      .slice(0, MAX_BATCH)
    if (sent.length) {
      const held = await supabaseAdmin
        .from(TABLE)
        .select('key, updated_at')
        .eq('user_id', who.uid)
        .in(
          'key',
          sent.map((e) => e.key),
        )
      if (held.error) return NextResponse.json({ error: held.error.message }, { status: 500 })
      const at = new Map((held.data ?? []).map((r) => [r.key as string, Date.parse(r.updated_at as string)]))
      // Each row gets its own saved_at, so a page boundary never splits rows that share a time.
      const newer = sent
        .filter((e) => !at.has(e.key) || Math.min(e.at, now) > at.get(e.key)!)
        .map((e, i) => ({
          user_id: who.uid,
          key: e.key,
          value: e.value,
          updated_at: new Date(Math.max(0, Math.min(e.at, now))).toISOString(),
          saved_at: new Date(now + i).toISOString(),
        }))
      if (newer.length) {
        const up = await supabaseAdmin.from(TABLE).upsert(newer)
        if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 })
      }
    }
    return NextResponse.json(
      {
        entries: page.map((r) => ({ key: r.key, value: r.value, at: Date.parse(r.updated_at as string) })),
        since: (page.at(-1)?.saved_at as string | undefined) ?? since,
        more: page.length < (rows ?? []).length || (rows ?? []).length === PAGE,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
