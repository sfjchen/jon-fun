import { NextResponse } from 'next/server'
import { shiftDay, siteDay } from '@/lib/daily'
import { captureAnthropeumDistribution } from '@/lib/daily/anthropeum'
import { dailyPuzzle } from '@/lib/daily/server'
import { GAME_IDS } from '@/lib/results'

export const maxDuration = 60

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const now = new Date()
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: '2-digit', hourCycle: 'h23',
  }).format(now))
  // The two UTC midnight hours cover both Pacific offsets. Later runs recover from late or failed feeds.
  if (hour > 3) return NextResponse.json({ skipped: true })
  const day = siteDay(now)
  const [results, stats] = await Promise.all([
    Promise.allSettled(GAME_IDS.map(game => dailyPuzzle(game, day))),
    captureAnthropeumDistribution(shiftDay(day, -1)).then(players => ({ players }), error => ({ error: String(error) })),
  ])
  const games = Object.fromEntries(results.map((result, i) => [
    GAME_IDS[i], result.status === 'fulfilled' ? { sourceDate: result.value.sourceDate } : { error: String(result.reason) },
  ]))
  const ok = results.every(result => result.status === 'fulfilled' && result.value.sourceDate === day)
  return NextResponse.json({ ok, day, games, previousAnthropeumStats: stats }, { status: ok ? 200 : 503 })
}
