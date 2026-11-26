'use client'

/** Opens a past Orbs category without initializing a ranked daily run. */

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import OrbsPlay from '@/components/daily/OrbsPlay'
import { playableDay } from '@/lib/daily'
import { isOrbsCategory, ORBS_CATEGORIES, type OrbsCategoryId, type OrbsPuzzle } from '@/lib/orbs'
import { useSiteDay } from '@/lib/play-day'
import { useDailyPuzzle } from '@/lib/use-daily-puzzle'

/** Loads and displays one past category from the exact day's puzzle. */
function Round({ day, category }: { day: string; category: OrbsCategoryId }) {
  const { data, error, retry } = useDailyPuzzle<OrbsPuzzle>('orbs', day)
  return (
    <>
      <p className="mb-3 text-sm text-[var(--ink-muted)]">
        {ORBS_CATEGORIES[category]} · {day}
      </p>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" className="mt-2 underline" onClick={retry}>
            Try again
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading the round…</p>
      ) : data.puzzle.categories.some((item) => item.id === category) ? (
        <OrbsPlay key={`${day}:${category}`} puzzle={data.puzzle} dailyDay={day} mode="archive" category={category} />
      ) : (
        <p role="alert">This category has no round on that date.</p>
      )}
    </>
  )
}

/** Rejects invalid categories, invalid dates and today's daily before loading any puzzle. */
function ArchiveRound() {
  const params = useSearchParams()
  const day = params.get('d')
  const category = params.get('c')
  const today = useSiteDay()
  if (!today) return <p role="status">Loading the round…</p>
  return (
    <div className="space-y-3">
      <Link href="/games/orbs/archive" className="inline-block text-sm font-medium text-[var(--ink-accent)] underline">
        Back to categories
      </Link>
      {playableDay('orbs', day) && day < today && isOrbsCategory(category) ? (
        <Round day={day} category={category} />
      ) : (
        <p role="alert">Choose a category and a past date from the archive.</p>
      )}
    </div>
  )
}

/** Renders the archive round described by the URL. */
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading the round…</p>}>
      <ArchiveRound />
    </Suspense>
  )
}
