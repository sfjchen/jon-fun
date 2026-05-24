import { NextRequest, NextResponse } from 'next/server'
import {
  findSessionByPin,
  getPlayerOffsetMs,
  recordBuzz,
  rowsToBuzzes,
} from '@/lib/jeopardy-buzzer-server'
import { isValidBuzzerPin } from '@/lib/jeopardy-buzzer'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// One year in ms — sanity bound on client-supplied timestamps.
const MAX_CLIENT_DRIFT_MS = 365 * 24 * 60 * 60 * 1000

/**
 * POST /api/jeopardy/buzzer/sessions/[pin]/buzz
 * Body: { playerId, name?, color?, clientPressAt: number (ms epoch), clockOffsetMs?: number }
 *
 * Server records its receive time, looks up the player's stored clock offset (falls back to
 * the request body if absent), and calls the atomic RPC. The RPC enforces:
 *   - session is 'armed'
 *   - effective_server_press_at >= armed_at - 100ms
 *   - one buzz per (round_id, player_id) — duplicate POSTs are silent no-ops
 *   - rank recompute over the whole round queue
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  const serverReceiveMs = Date.now()
  const { pin } = await params
  if (!isValidBuzzerPin(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })

  let body: { playerId?: unknown; name?: unknown; color?: unknown; clientPressAt?: unknown; clockOffsetMs?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const playerId = typeof body.playerId === 'string' ? body.playerId : ''
  if (!UUID_RE.test(playerId)) return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 })

  const clientPressAt = typeof body.clientPressAt === 'number' ? body.clientPressAt : NaN
  if (!Number.isFinite(clientPressAt) || Math.abs(clientPressAt - serverReceiveMs) > MAX_CLIENT_DRIFT_MS) {
    return NextResponse.json({ error: 'Invalid clientPressAt' }, { status: 400 })
  }

  const session = await findSessionByPin(pin)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Trust the per-player offset we stored at join time; only fall back to the request body
  // if we have nothing on file (first buzz before join completed).
  const storedOffset = await getPlayerOffsetMs(session.id, playerId)
  const offsetFromBody = typeof body.clockOffsetMs === 'number' ? body.clockOffsetMs : 0
  const clockOffsetMs = storedOffset !== 0 ? storedOffset : offsetFromBody

  const playerName = typeof body.name === 'string' ? body.name : 'Player'
  const playerColor = typeof body.color === 'string' ? body.color : '#3b82f6'

  try {
    const result = await recordBuzz({
      sessionId: session.id,
      playerId,
      playerName,
      playerColor,
      clientPressMs: Math.floor(clientPressAt),
      serverReceiveMs,
      clockOffsetMs,
    })

    if (result.rejectReason) {
      return NextResponse.json(
        { rejected: true, reason: result.rejectReason, session },
        { status: 200 },
      )
    }
    return NextResponse.json({
      session,
      queue: rowsToBuzzes(result.queue),
      me: result.myRow ? rowsToBuzzes([result.myRow])[0] : null,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'RPC failed' }, { status: 500 })
  }
}
