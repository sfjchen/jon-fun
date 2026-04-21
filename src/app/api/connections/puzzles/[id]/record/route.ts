import { NextRequest, NextResponse } from 'next/server'
import { validate as uuidValidate } from 'uuid'
import { connectionsBackendReady } from '@/lib/connections/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!connectionsBackendReady()) {
    return NextResponse.json({ error: 'connections_unavailable' }, { status: 503 })
  }
  const { id: idOrSlug } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const o = body as Record<string, unknown>
  const solved = o.solved === true
  const mistakesRaw = o.mistakes
  const mistakes = typeof mistakesRaw === 'number' && Number.isFinite(mistakesRaw) ? Math.floor(mistakesRaw) : 0
  const clamped = Math.max(0, Math.min(4, mistakes))

  let puzzleId = idOrSlug
  if (!uuidValidate(idOrSlug)) {
    const { data: row, error: e1 } = await supabaseAdmin
      .from('connections_puzzles')
      .select('id')
      .eq('slug', idOrSlug)
      .maybeSingle()
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!row?.id) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    puzzleId = row.id as string
  } else {
    const { data: row, error: e1 } = await supabaseAdmin.from('connections_puzzles').select('id').eq('id', puzzleId).maybeSingle()
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.rpc('connections_record_play', {
    p_id: puzzleId,
    p_solved: solved,
    p_mistakes: clamped,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
