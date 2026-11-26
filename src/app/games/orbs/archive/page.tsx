'use client'

/** Lists available rounds and independent completion marks for each Orbs category. */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Mark, playState } from '@/components/daily/ScoreTable'
import { playableDay, shiftDay } from '@/lib/daily'
import { orbsRunKey } from '@/lib/daily/saved-run'
import { ORBS_ROTATION_START, ORBS_CATEGORIES, orbsArchiveHref, type OrbsCategoryId, type OrbsIndex } from '@/lib/orbs'
import { archiveRoundDone, orbsDailyDone } from '@/lib/orbs-storage'
import { useSiteDay } from '@/lib/play-day'
import { boardUrl, isPracticeResult, type BoardRow } from '@/lib/results'
import { usePlayer } from '@/lib/use-player'

const categories = Object.keys(ORBS_CATEGORIES) as OrbsCategoryId[]

/** Loads the category index and the current player's ranked Orbs completions. */
export default function ArchivePage() {
  const today = useSiteDay()
  const router = useRouter()
  const player = usePlayer()
  const name = player?.name
  const group = player?.group
  const [index, setIndex] = useState<OrbsIndex>()
  const [error, setError] = useState(false)
  const [attempt, retry] = useState(0)
  const [publisherDay, setPublisherDay] = useState('')
  const [board, setBoard] = useState<{ name: string; group: string; days: Set<string> }>()

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/orbs/categories.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load the Orbs archive')
        return response.json() as Promise<OrbsIndex>
      })
      .then(setIndex)
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (!name || !group) return
    const controller = new AbortController()
    void fetch(boardUrl({ group, game: 'orbs', days: 6000 }), { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ rows: BoardRow[] }>) : null))
      .then((result) => {
        if (!result || controller.signal.aborted) return
        const days = result.rows
          .filter(
            (row) => row.game === 'orbs' && row.name.toLowerCase() === name.toLowerCase() && playState(row) === 'done',
          )
          .map((row) => row.day)
        setBoard({ name, group, days: new Set(days) })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [group, name])

  const rotation: string[] = []
  for (let day = ORBS_ROTATION_START; day < today; day = shiftDay(day, 1)) rotation.push(day)
  const editions = [...new Set([...Object.values(index ?? {}).flat(), ...rotation])]
    .filter((day) => playableDay('orbs', day) && day < today)
    .sort((a, b) => b.localeCompare(a))
  const syncedDays = board && board.name === name && board.group === group ? board.days : undefined

  /** Uses the ranked board or a finished daily run on this device for the daily mark. */
  function dailyDone(day: string) {
    return syncedDays?.has(day) || (!isPracticeResult('orbs', day) && orbsDailyDone(orbsRunKey(day)))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-[var(--ink-muted)]">Pick a date for the full edition, or browse by theme.</p>
        <Link href="/games/orbs" className="font-medium text-[var(--ink-accent)] underline">
          Play today’s Orbs
        </Link>
      </div>
      {today && (
        <form
          className="flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(event) => {
            event.preventDefault()
            window.location.assign(`https://dailyorbs.com/${publisherDay || today}`)
          }}
        >
          <label htmlFor="publisher-day">Publisher’s archive</label>
          <input
            id="publisher-day"
            type="date"
            required
            min="2026-04-17"
            max={today}
            value={publisherDay || today}
            onChange={(event) => setPublisherDay(event.target.value)}
          />
          <button className="underline">Open original edition ↗</button>
        </form>
      )}
      {error ? (
        <div role="alert" className="rounded-xl border border-[var(--ink-border)] p-4 text-sm">
          <p>Could not load the archive.</p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => {
              setError(false)
              retry(attempt + 1)
            }}
          >
            Try again
          </button>
        </div>
      ) : !index || !today ? (
        <p role="status" className="text-sm text-[var(--ink-muted)]">
          Loading past rounds…
        </p>
      ) : (
        <>
          <details className="rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-4">
            <summary className="cursor-pointer font-semibold">Browse complete editions</summary>
            {editions.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {editions.map((day) => (
                  <li key={day}>
                    <Link
                      className="block rounded-lg bg-[var(--ink-bg)] px-3 py-2 text-sm underline"
                      href={orbsArchiveHref(day)}
                    >
                      {day}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--ink-muted)]">No past editions yet.</p>
            )}
          </details>
          <p className="text-xs text-[var(--ink-muted)]">Each theme shows Archive and Daily completion marks.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((category) => {
              const days = [...new Set([...index[category], ...rotation])]
                .sort()
                .filter((day) => playableDay('orbs', day) && day < today)
                .reverse()
              const unplayed = days.filter((day) => !archiveRoundDone(day, category))
              const pool = unplayed.length ? unplayed : days
              return (
                <section
                  key={category}
                  aria-label={ORBS_CATEGORIES[category]}
                  className="rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold">{ORBS_CATEGORIES[category]}</h2>
                    <button
                      type="button"
                      disabled={!pool.length}
                      onClick={() => {
                        const day = pool[Math.floor(Math.random() * pool.length)]
                        if (day) router.push(orbsArchiveHref(day, category))
                      }}
                      className="min-h-10 rounded-full border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 text-sm font-medium hover:border-[var(--ink-accent)] disabled:opacity-50"
                    >
                      Random
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {days.length - unplayed.length} of {days.length} rounds played
                  </p>
                  {!!days.length && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium">Choose a date</summary>
                      <ul className="mt-1">
                        {days.map((day) => (
                          <li key={day} className="flex items-center gap-2 border-t border-[var(--ink-border)] py-2">
                            <Link className="mr-auto text-sm underline" href={orbsArchiveHref(day, category)}>
                              {day}
                            </Link>
                            <Mark state={archiveRoundDone(day, category) ? 'done' : 'none'} label="Archive" size={17} />
                            <Mark state={dailyDone(day) ? 'done' : 'none'} label="Daily" size={14} />
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
