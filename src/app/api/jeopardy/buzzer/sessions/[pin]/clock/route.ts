import { NextRequest, NextResponse } from 'next/server'
import { isValidBuzzerPin } from '@/lib/jeopardy-buzzer'

export const dynamic = 'force-dynamic'

/**
 * GET /api/jeopardy/buzzer/sessions/[pin]/clock?t0=<clientMs>
 * Echoes the client's `t0` back alongside the server's current `Date.now()`.
 * Used by the player page to estimate (server - client) clock offset via Cristian's algorithm.
 *
 * Intentionally minimal — no DB hit — so it returns as fast as possible (the whole point
 * is to measure network RTT cleanly).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params
  if (!isValidBuzzerPin(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  const t0Raw = req.nextUrl.searchParams.get('t0')
  const t0 = t0Raw ? Number(t0Raw) : 0
  const tS = Date.now()
  return NextResponse.json({ t0: Number.isFinite(t0) ? t0 : 0, tS }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
