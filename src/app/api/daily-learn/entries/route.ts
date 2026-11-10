/**
 * 1 Sentence Everyday sync API (Application Programming Interface).
 * Rows keep the client's updatedAt, and a write only lands when it is newer than the stored row, so
 * repeated full pushes from stale devices never overwrite newer entries. Empty text marks a deleted day.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const TABLE = 'daily_learn_entries'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Returns every row for a user, tombstones included, so clients can merge deletions.
 * Rows without updated_at report the epoch so they never win a merge.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = new URL(request.url).searchParams.get('userId')?.trim()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('date, text, updated_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const entries = (data ?? []).map((r) => ({
      date: r.date,
      text: r.text ?? '',
      updatedAt: r.updated_at ?? new Date(0).toISOString(),
    }))
    return NextResponse.json({ entries })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

type Row = { user_id: string; date: string; text: string; updated_at: string }

/**
 * Upserts only the rows that are new or newer than what is stored.
 * Future timestamps are clamped to now so a fast device clock cannot pin an entry forever.
 * A row without updatedAt (older cached clients) only fills a missing date.
 */
async function writeNewer(userId: string, incoming: Array<{ date?: string; text?: string; updatedAt?: string }>) {
  const now = Date.now()
  const byDate = new Map<string, { row: Row; ms: number | null }>()
  for (const e of incoming) {
    if (!e?.date || !DATE_RE.test(e.date)) continue
    const parsed = Date.parse(e.updatedAt ?? '')
    const ms = Number.isNaN(parsed) ? null : Math.min(parsed, now)
    const prev = byDate.get(e.date)
    if (prev && (prev.ms ?? -1) >= (ms ?? -1)) continue
    byDate.set(e.date, {
      ms,
      row: {
        user_id: userId,
        date: e.date,
        text: (e.text ?? '').trim(),
        updated_at: new Date(ms ?? now).toISOString(),
      },
    })
  }
  if (byDate.size === 0) return null
  const { data: existing, error: readErr } = await supabaseAdmin
    .from(TABLE)
    .select('date, updated_at')
    .eq('user_id', userId)
    .in('date', [...byDate.keys()])
  if (readErr) return readErr
  const stored = new Map((existing ?? []).map((r) => [r.date as string, Date.parse(r.updated_at ?? '') || 0]))
  const rows: Row[] = []
  for (const [date, { row, ms }] of byDate) {
    const cur = stored.get(date)
    if (cur === undefined ? row.text.length > 0 || ms !== null : ms !== null && ms > cur) rows.push(row)
  }
  if (rows.length === 0) return null
  const { error } = await supabaseAdmin.from(TABLE).upsert(rows, { onConflict: 'user_id,date' })
  return error
}

/** Merges a batch of entries into the user's rows (newest updatedAt wins per date). */
export async function POST(request: NextRequest) {
  try {
    const { userId, entries } = (await request.json()) as {
      userId?: string
      entries?: Array<{ date?: string; text?: string; updatedAt?: string }>
    }
    if (!userId?.trim()) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    const error = await writeNewer(userId.trim(), Array.isArray(entries) ? entries : [])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

/** Marks a day deleted with a tombstone (kept for older cached clients that still call DELETE). */
export async function DELETE(request: NextRequest) {
  try {
    const { userId, date } = (await request.json()) as { userId?: string; date?: string }
    if (!userId?.trim() || !date?.trim()) {
      return NextResponse.json({ error: 'userId and date required' }, { status: 400 })
    }
    const error = await writeNewer(userId.trim(), [{ date: date.trim(), text: '', updatedAt: new Date().toISOString() }])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
