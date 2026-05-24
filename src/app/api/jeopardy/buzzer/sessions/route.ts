import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { ensureSessionForBoard } from '@/lib/jeopardy-buzzer-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/jeopardy/buzzer/sessions
 * Body: { slug: string }
 * Get-or-create the buzzer session for a Jeopardy board.
 */
export async function POST(req: NextRequest) {
  let body: { slug?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const slug = typeof body.slug === 'string' ? body.slug : ''
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })

  const { data: board, error: boardErr } = await supabase
    .from('jeopardy_boards')
    .select('id, slug, title')
    .eq('slug', slug)
    .single()
  if (boardErr || !board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const result = await ensureSessionForBoard(board.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ session: result.session, board: { slug: board.slug, title: board.title } })
}
