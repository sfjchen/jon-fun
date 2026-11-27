/**
 * Recent Jeopardy boards API. Keeps each sync account's list of visited boards (the sync key, or the device ID
 * for a browser with no key), so the list follows the account to every device.
 * POST merges a device's list into the account and returns the merged list. DELETE takes 1 board off it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveSyncUser } from '@/lib/syncAccess'
import { MAX_RECENTS, type RecentBoard } from '@/lib/jeopardy-identity'

const TABLE = 'jeopardy_recents'
const SLUG_RE = /^[a-z0-9-]{3,80}$/
const TITLE_MAX = 120

/**
 * Merges the device's recents into the account, where the newer visit wins per board and a newer removal stays
 * removed, then returns the account's live list, newest first.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; recents?: RecentBoard[] }
    const who = resolveSyncUser(body.userId)
    if ('error' in who) return NextResponse.json({ error: who.error }, { status: who.status })
    const sent = (Array.isArray(body.recents) ? body.recents : [])
      .filter((r) => r && SLUG_RE.test(r.slug) && Number.isFinite(r.visitedAt))
      .slice(0, MAX_RECENTS)
    const { data: rows, error } = await supabaseAdmin
      .from(TABLE)
      .select('slug, title, visited_at, removed')
      .eq('user_id', who.uid)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const now = Date.now()
    const all = new Map(
      (rows ?? []).map((r) => [
        r.slug as string,
        { title: r.title as string, visitedAt: Date.parse(r.visited_at as string), removed: r.removed as boolean },
      ]),
    )
    const newer = sent
      .map((r) => ({ ...r, visitedAt: Math.min(r.visitedAt, now) }))
      .filter((r) => r.visitedAt > (all.get(r.slug)?.visitedAt ?? 0))
    if (newer.length) {
      const up = await supabaseAdmin.from(TABLE).upsert(
        newer.map((r) => ({
          user_id: who.uid,
          slug: r.slug,
          title: String(r.title || r.slug).slice(0, TITLE_MAX),
          visited_at: new Date(r.visitedAt).toISOString(),
          removed: false,
        })),
      )
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 })
      for (const r of newer) all.set(r.slug, { title: r.title || r.slug, visitedAt: r.visitedAt, removed: false })
    }
    const recents: RecentBoard[] = [...all]
      .filter(([, r]) => !r.removed)
      .map(([slug, r]) => ({ slug, title: r.title, visitedAt: r.visitedAt }))
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, MAX_RECENTS)
    return NextResponse.json({ recents }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

/**
 * Marks a board removed from the account's list, so it leaves every device on the account.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; slug?: string }
    const who = resolveSyncUser(body.userId)
    if ('error' in who) return NextResponse.json({ error: who.error }, { status: who.status })
    if (!body.slug || !SLUG_RE.test(body.slug)) return NextResponse.json({ error: 'slug required' }, { status: 400 })
    const { error } = await supabaseAdmin
      .from(TABLE)
      .upsert({ user_id: who.uid, slug: body.slug, visited_at: new Date().toISOString(), removed: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
