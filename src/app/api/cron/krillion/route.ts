/**
 * Saves the original Krillion's player curve just before its Eastern day ends, since the final curve is gone after
 * the reset. The day's prompts and answer review are captured by /api/cron/daily.
 */

import { NextResponse } from 'next/server'
import { cronDenied } from '@/lib/api-guards'
import { captureKrillionDist } from '@/lib/daily/krillion'

export const maxDuration = 60

export async function GET(req: Request) {
  const denied = cronDenied(req)
  if (denied) return denied
  try {
    const date = await captureKrillionDist()
    return NextResponse.json(date ? { ok: true, distDate: date } : { skipped: true })
  } catch {
    return NextResponse.json({ error: 'Krillion curve capture failed' }, { status: 503 })
  }
}
