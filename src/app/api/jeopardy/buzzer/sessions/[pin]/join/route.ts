import { NextRequest, NextResponse } from 'next/server'
import { findSessionByPin, upsertPlayer } from '@/lib/jeopardy-buzzer-server'
import { isValidBuzzerPin } from '@/lib/jeopardy-buzzer'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/jeopardy/buzzer/sessions/[pin]/join
 * Body: { playerId: uuid, name: string, color: string, clockOffsetMs: number }
 * Upserts a player row + records the latest measured clock offset.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params
  if (!isValidBuzzerPin(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })

  let body: { playerId?: unknown; name?: unknown; color?: unknown; clockOffsetMs?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const playerId = typeof body.playerId === 'string' ? body.playerId : ''
  if (!UUID_RE.test(playerId)) return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 })

  const session = await findSessionByPin(pin)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const res = await upsertPlayer({
    sessionId: session.id,
    playerId,
    name: typeof body.name === 'string' ? body.name : 'Player',
    color: typeof body.color === 'string' ? body.color : '#3b82f6',
    clockOffsetMs: typeof body.clockOffsetMs === 'number' ? body.clockOffsetMs : 0,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
  return NextResponse.json({ session })
}
