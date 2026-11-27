import { NextResponse } from 'next/server'
import { cronDenied } from '@/lib/api-guards'
import { shiftDay, siteDay, siteHour } from '@/lib/daily'
import { captureAnthropeumDistribution } from '@/lib/daily/anthropeum'
import { captureKrillionDist } from '@/lib/daily/krillion'
import { publisherOrbsForDay } from '@/lib/daily/publisher-orbs'
import { dailyPuzzle } from '@/lib/daily/server'
import { pruneRooms } from '@/lib/puzzle-rooms/server'
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
  const [results, stats, roomsDeleted, publisherOrbs] = await Promise.all([
    Promise.allSettled(GAME_IDS.map((game) => dailyPuzzle(game, day))),
    captureAnthropeumDistribution(shiftDay(day, -1)).then(
      (players) => ({ players }),
      (error) => ({ error: String(error) }),
    ),
    // A failed cleanup is retried by the next run, so it never fails the puzzle sync.
    pruneRooms().catch((error) => ({ error: String(error) })),
    publisherOrbsForDay(day).then(
      ({ edition }) => ({ sourceDate: edition.dateKey }),
      (error) => ({ error: String(error) }),
    ),
  ])
  const games = Object.fromEntries(
    results.map((result, i) => [
      GAME_IDS[i],
      result.status === 'fulfilled' ? { sourceDate: result.value.sourceDate } : { error: String(result.reason) },
    ]),
  )
  const ok =
    'sourceDate' in publisherOrbs &&
    results.every((result) => result.status === 'fulfilled' && result.value.sourceDate === day)
  return NextResponse.json(
    { ok, day, games, publisherOrbs, previousAnthropeumStats: stats, krillionCurve, roomsDeleted },
    { status: ok ? 200 : 503 },
  )
}
