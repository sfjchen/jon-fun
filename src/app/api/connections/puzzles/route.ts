import { NextRequest, NextResponse } from 'next/server'
import { generateConnectionsId } from '@/lib/connections'
import {
  connectionsBackendReady,
  connectionsPayloadTooLarge,
  dbRowToSummary,
  parseConnectionsUpsertBody,
  puzzleToDbRow,
  type ConnectionsDbRow,
} from '@/lib/connections/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  if (!connectionsBackendReady()) {
    return NextResponse.json({ error: 'connections_unavailable' }, { status: 503 })
  }

  const sort = request.nextUrl.searchParams.get('sort') ?? 'newest'
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 200))

  let q = supabaseAdmin.from('connections_puzzles').select(
    'id, slug, title, description, tags, groups, author_display, play_count, solve_count, total_mistakes, created_at, updated_at',
  )

  if (sort === 'plays') {
    q = q.order('play_count', { ascending: false }).order('updated_at', { ascending: false })
  } else if (sort === 'solve_rate') {
    // Approximate: order by solve_count desc then play_count — exact rate needs computed column or raw SQL; good enough for v1.
    q = q.order('solve_count', { ascending: false }).order('play_count', { ascending: false })
  } else {
    q = q.order('updated_at', { ascending: false })
  }

  q = q.limit(limit)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try {
    const summaries = (data ?? []).map((row) => dbRowToSummary(row as ConnectionsDbRow))
    return NextResponse.json(summaries)
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'parse_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!connectionsBackendReady()) {
    return NextResponse.json({ error: 'connections_unavailable' }, { status: 503 })
  }

  let raw: string
  try {
    raw = await request.text()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (connectionsPayloadTooLarge(raw)) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw) as unknown
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Ensure id for new rows
  if (body && typeof body === 'object' && !('id' in body)) {
    ;(body as Record<string, unknown>).id = generateConnectionsId()
  }
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>
    o.updatedAt = new Date().toISOString()
    if (typeof o.createdAt !== 'string') o.createdAt = o.updatedAt
  }

  let puzzle
  try {
    puzzle = parseConnectionsUpsertBody(body)
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'Invalid puzzle'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const row = { ...puzzleToDbRow(puzzle), play_count: 0, solve_count: 0, total_mistakes: 0 }

  const { error } = await supabaseAdmin.from('connections_puzzles').insert(row)
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'slug_exists', detail: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: puzzle.id, slug: puzzle.slug })
}
