/** Looks up a published Daily Orbs date and confirms the server saved its full payload. */

import { NextResponse } from 'next/server'
import { siteDay } from '@/lib/daily'
import { publisherOrbsDate, publisherOrbsForDay } from '@/lib/daily/publisher-orbs'

import { publisherOrbsPlayable } from '@/lib/daily/publisher-orbs-play'
import { ORB_COLORS } from '@/lib/publisher-orbs'

export const maxDuration = 25

/** Returns edition metadata and, when requested, its playable fields. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const requested = params.get('d')
  const day = requested ?? siteDay()
  if (!publisherOrbsDate(day))
    return NextResponse.json({ error: 'Choose a published Daily Orbs date.' }, { status: 400 })
  try {
    const { edition, fetchedAt, sourceUrl } = await publisherOrbsForDay(day)
    const puzzles = ORB_COLORS.map((color) => {
      const { id, title, type } = edition.puzzles[color]
      return { color, id, title, type }
    })
    return NextResponse.json(
      {
        day,
        sourceDate: edition.dateKey,
        originalDate: edition.originalDate,
        fetchedAt,
        sourceUrl,
        puzzles,
        ...(params.get('play') === '1' ? { playable: publisherOrbsPlayable(edition.puzzles) } : {}),
      },
      {
        headers: { 'Cache-Control': requested ? 'public, s-maxage=300, stale-while-revalidate=600' : 'no-store' },
      },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not load the Daily Orbs edition.',
      },
      { status: 503 },
    )
  }
}
