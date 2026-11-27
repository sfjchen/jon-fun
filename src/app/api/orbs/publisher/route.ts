/** Looks up a published Daily Orbs date and confirms the server saved its full payload. */

import { NextResponse } from 'next/server'
import { siteDay } from '@/lib/daily'
import { publisherOrbsDate, publisherOrbsForDay } from '@/lib/daily/publisher-orbs'

export const maxDuration = 25
const colors = ['orange', 'green', 'blue', 'purple'] as const

/** Returns edition metadata to callers while keeping the exact saved puzzle data available server-side. */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('d')
  const day = requested ?? siteDay()
  if (!publisherOrbsDate(day))
    return NextResponse.json({ error: 'Choose a published Daily Orbs date.' }, { status: 400 })
  try {
    const { edition, fetchedAt, sourceUrl } = await publisherOrbsForDay(day)
    const puzzles = colors.map((color) => {
      const { id, title, type } = edition.puzzles[color]
      return { color, id, title, type }
    })
    return NextResponse.json(
      { day, sourceDate: edition.dateKey, originalDate: edition.originalDate, fetchedAt, sourceUrl, puzzles },
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
