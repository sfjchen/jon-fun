/**
 * Returns where a Krillion score sits among the original game's players for a date: the percentile beaten and
 * the 20-bin score distribution drawn on the final screen.
 */
import { NextResponse } from 'next/server'
import { krillionPercentile } from '@/lib/daily/krillion'
import { DAILY_EPOCH, validDay } from '@/lib/daily'
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, day = q.get('d') ?? '', score = Number(q.get('score'))
  if (!validDay(day) || day < DAILY_EPOCH || !Number.isInteger(score) || score < 0 || score > 700) return NextResponse.json({ error: 'Invalid date or score' }, { status: 400 })
  const result = await krillionPercentile(day, score).catch(() => null)
  return result ? NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=300' } }) : NextResponse.json({ error: 'No player curve for this day' }, { status: 404 })
}
