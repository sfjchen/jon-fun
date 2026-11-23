/**
 * Saves the original Krillion's player curve through the last hours before its Eastern day ends, since the curve
 * is gone after the reset. Hobby crons fire at an unknown minute of their hour, so every run saves and the last one
 * before the reset wins. /api/cron/daily saves it too, along with the day's prompts and answer review.
 */

import { NextResponse } from 'next/server'
import { cronDenied } from '@/lib/api-guards'
import { captureKrillionDist } from '@/lib/daily/krillion'

export const maxDuration = 60

export async function GET(req: Request) {
  const denied = cronDenied(req)
  if (denied) return denied
  try {
    return NextResponse.json({ ok: true, distDate: await captureKrillionDist() })
  } catch {
    return NextResponse.json({ error: 'Krillion curve capture failed' }, { status: 503 })
  }
}
