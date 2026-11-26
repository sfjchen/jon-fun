'use client'

/** Opens a past dated edition or category without initializing a ranked daily run. */

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import DayPicker from '@/components/daily/DayPicker'
import OrbsPlay from '@/components/daily/OrbsPlay'
import { firstDay, playableDay, shiftDay } from '@/lib/daily'
import { isOrbsCategory, orbsArchiveHref, type OrbsCategoryId, type OrbsPuzzle } from '@/lib/orbs'
import { useSiteDay } from '@/lib/play-day'
import { useDailyPuzzle } from '@/lib/use-daily-puzzle'

/** Loads the same dated puzzle that the daily route uses. */
function Round({ day, today, category }: { day: string; today: string; category: OrbsCategoryId | undefined }) {
  const router = useRouter()
  const { data, error, retry } = useDailyPuzzle<OrbsPuzzle>('orbs', day)
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <DayPicker
          day={day}
          today=""
          minDay={firstDay('orbs')}
          maxDay={shiftDay(today, -1)}
          go={(to) => router.replace(orbsArchiveHref(to, category), { scroll: false })}
          className="mr-auto"
        />
        {category && (
          <Link className="text-[var(--ink-accent)] underline" href={orbsArchiveHref(day)} prefetch={false}>
            Full edition
          </Link>
        )}
        <a
          className="text-[var(--ink-accent)] underline"
          href={`https://dailyorbs.com/${day}`}
          target="_blank"
          rel="noreferrer"
        >
          Publisher’s edition ↗
        </a>
      </div>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" className="mt-2 underline" onClick={retry}>
            Try again
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading the round…</p>
      ) : !category || data.puzzle.categories.some((item) => item.id === category) ? (
        <OrbsPlay
          key={`${day}:${category ?? 'edition'}`}
          puzzle={data.puzzle}
          dailyDay={day}
          mode="archive"
          {...(category ? { category } : {})}
        />
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
        Back to archive
      </Link>
      {playableDay('orbs', day) && day < today && (category === null || isOrbsCategory(category)) ? (
        <Round day={day} today={today} category={category ?? undefined} />
      ) : (
        <p role="alert">Choose a past date from the archive.</p>
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
