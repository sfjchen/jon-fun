import { NextResponse } from 'next/server'
import { cronDenied } from '@/lib/api-guards'
import { shiftDay, siteDay, siteHour } from '@/lib/daily'
import { captureAnthropeumDistribution } from '@/lib/daily/anthropeum'
import { captureKrillionDist } from '@/lib/daily/krillion'
import { dailyPuzzle } from '@/lib/daily/server'
import { crosswordForDay } from '@/lib/puzzle-rooms/crossword'
import { GAME_IDS } from '@/lib/results'

export const maxDuration = 60

export async function GET(req: Request) {
  const denied = cronDenied(req)
  if (denied) return denied
  // Every run saves the open Krillion day's player curve, so a day nobody plays here still has one from its start.
  const krillionCurve = await captureKrillionDist().catch((error) => ({ error: String(error) }))
  // The 07:00 and 08:00 UTC runs cover Pacific midnight in both offsets, so the earlier one skips in winter while it
  // is still 11 p.m. The later runs retry late or failed feeds through the 3 a.m. hour.
  if (siteHour() > 3) return NextResponse.json({ skipped: true, krillionCurve })
  const day = siteDay()
  const [results, stats, crossword] = await Promise.all([
    Promise.allSettled(GAME_IDS.map((game) => dailyPuzzle(game, day))),
    captureAnthropeumDistribution(shiftDay(day, -1)).then(
      (players) => ({ players }),
      (error) => ({ error: String(error) }),
    ),
    process.env.CROSSWORD_DAILY_FEED_URL
      ? crosswordForDay(day, false).then(
          (puzzle) => ({ sourceDate: puzzle.date }),
          () => ({ error: 'Could not sync the daily crossword feed' }),
        )
      : null,
  ])
  const games = Object.fromEntries(
    results.map((result, i) => [
      GAME_IDS[i],
      result.status === 'fulfilled' ? { sourceDate: result.value.sourceDate } : { error: String(result.reason) },
    ]),
  )
  if (crossword) games.crossword = crossword
  const ok =
    results.every((result) => result.status === 'fulfilled' && result.value.sourceDate === day) &&
    (!crossword || ('sourceDate' in crossword && crossword.sourceDate === day))
  return NextResponse.json(
    { ok, day, games, previousAnthropeumStats: stats, krillionCurve },
    { status: ok ? 200 : 503 },
  )
}
