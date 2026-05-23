import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import {
  applyPlayOp,
  isJeopardyPlayOp,
  normalizePlayState,
  type JeopardyPlayOp,
} from '@/lib/jeopardy-play-ops'

function isValidSlug(s: string): boolean {
  return typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s)
}

async function loadRow(slug: string) {
  return supabase
    .from('jeopardy_boards')
    .select('slug, play_state, play_version, play_updated_at')
    .eq('slug', slug)
    .single()
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  const { data, error } = await loadRow(slug)
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    slug: data.slug,
    playState: normalizePlayState(data.play_state),
    playVersion: data.play_version,
    playUpdatedAt: data.play_updated_at,
  })
}

const MAX_DELTA = 1_000_000

function sanitizeOp(op: JeopardyPlayOp): JeopardyPlayOp {
  switch (op.kind) {
    case 'setTeamName':
      return { ...op, name: (op.name || '').toString().slice(0, 24) }
    case 'setTeamScore':
      return { ...op, score: clampNum(op.score, -MAX_DELTA, MAX_DELTA) }
    case 'adjustTeamScore':
      return { ...op, delta: clampNum(op.delta, -MAX_DELTA, MAX_DELTA) }
    default:
      return op
  }
}

function clampNum(n: unknown, min: number, max: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 0
  return Math.max(min, Math.min(max, v))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  let body: { op?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!isJeopardyPlayOp(body.op)) return NextResponse.json({ error: 'Invalid op' }, { status: 400 })
  const op = sanitizeOp(body.op)

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row, error } = await loadRow(slug)
    if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const current = normalizePlayState(row.play_state)
    const next = applyPlayOp(current, op)
    const now = new Date().toISOString()

    const { data: updated, error: upErr } = await supabase
      .from('jeopardy_boards')
      .update({
        play_state: next,
        play_version: row.play_version + 1,
        play_updated_at: now,
      })
      .eq('slug', slug)
      .eq('play_version', row.play_version)
      .select('slug, play_state, play_version, play_updated_at')
      .maybeSingle()

    if (upErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    if (updated) {
      return NextResponse.json({
        slug: updated.slug,
        playState: normalizePlayState(updated.play_state),
        playVersion: updated.play_version,
        playUpdatedAt: updated.play_updated_at,
      })
    }
  }
  return NextResponse.json({ error: 'Write conflict; retry' }, { status: 409 })
}
