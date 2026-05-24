import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import {
  applySessionPatch,
  findSessionByPin,
  readCurrentQueue,
  rowsToBuzzes,
  type SessionPatch,
} from '@/lib/jeopardy-buzzer-server'
import { isValidBuzzerPin } from '@/lib/jeopardy-buzzer'

export const dynamic = 'force-dynamic'

const ALLOWED_PATCH: SessionPatch['kind'][] = ['arm', 'clear', 'lock', 'unlock']

function isValidPatch(x: unknown): x is SessionPatch {
  if (!x || typeof x !== 'object') return false
  const k = (x as { kind?: unknown }).kind
  return typeof k === 'string' && (ALLOWED_PATCH as string[]).includes(k)
}

/** GET /api/jeopardy/buzzer/sessions/[pin] — resolve session, board, and current queue. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params
  if (!isValidBuzzerPin(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  const session = await findSessionByPin(pin)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: board } = await supabase
    .from('jeopardy_boards')
    .select('slug, title')
    .eq('id', session.boardId)
    .single()

  const queueRows = await readCurrentQueue(session)
  return NextResponse.json({
    session,
    board: board ? { slug: board.slug, title: board.title } : null,
    queue: rowsToBuzzes(queueRows),
  })
}

/** PATCH /api/jeopardy/buzzer/sessions/[pin] — host control: arm/clear/lock/unlock. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params
  if (!isValidBuzzerPin(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  let body: { op?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!isValidPatch(body.op)) return NextResponse.json({ error: 'Invalid op' }, { status: 400 })

  const result = await applySessionPatch(pin, body.op)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ session: result.session })
}
