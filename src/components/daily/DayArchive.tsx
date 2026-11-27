'use client'

/**
 * Dated archive page for a publisher game played in the daily shell: the shared header, a completion mark per past
 * edition from this device's saved runs, editions grouped by month, and a random pick of an unfinished one.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { HomeLink } from '@/components/HomeLink'
import { DailyHeader } from '@/components/daily/DailyDrawer'
import { Mark, type PlayState } from '@/components/daily/ScoreTable'
import { runKey } from '@/lib/daily/saved-run'
import { GAMES } from '@/lib/results'

type ArchiveGame = 'headcount' | 'kabloom'
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/**
 * Re-reads the marks when another tab saves a run.
 */
function subscribe(cb: () => void): () => void {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}

/**
 * Reads how far this device got in an edition: 5 locked Headcount rooms or a Kabloom climb that ended is done.
 */
function stateOf(game: ArchiveGame, day: string): PlayState {
  try {
    const v = JSON.parse(localStorage.getItem(runKey(game, day, day)) ?? 'null') as
      unknown[] | { moves?: unknown[]; start?: number | null; over?: boolean } | null
    if (Array.isArray(v)) return v.length ? (v.length >= 5 ? 'done' : 'started') : 'none'
    return v?.over ? 'done' : v?.start || v?.moves?.length ? 'started' : 'none'
  } catch {
    return 'none'
  }
}

/**
 * Renders the header and the past editions, newest first, with `nouns` as the singular and plural edition name.
 */
export default function DayArchive({
  game,
  days,
  nouns: [one, many],
}: {
  game: ArchiveGame
  days: string[]
  nouns: [string, string]
}) {
  const router = useRouter()
  const { title, url } = GAMES[game]
  const marks = useSyncExternalStore(
    subscribe,
    () => days.map((day) => stateOf(game, day)).join(','),
    () => '',
  ).split(',') as PlayState[]
  const state = (i: number): PlayState => marks[i] || 'none'
  const done = days.filter((_, i) => state(i) === 'done').length
  const months = new Map<string, number[]>()
  days.forEach((day, i) => months.set(day.slice(0, 7), [...(months.get(day.slice(0, 7)) ?? []), i]))
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="daily-heading mb-4 flex min-h-12 items-center gap-2 border-b border-[var(--ink-border)]">
        <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
        <h1 className="mr-auto font-lora font-bold">{title} Archive</h1>
        <Link className="text-sm underline" href={url}>
          Play today
        </Link>
        <DailyHeader compact />
      </header>
      {days.length === 0 ? (
        <p className="rounded-xl bg-[var(--ink-paper)] p-4 text-sm" data-testid={`${game}-archive-empty`}>
          No past {many} yet. Each {one} shows up here the day after it opens.
        </p>
      ) : (
        <div className="space-y-3" data-testid={`${game}-archive`}>
          <div className="flex items-center justify-between rounded-xl bg-[var(--ink-paper)] px-4 py-3">
            <span className="text-sm">
              {done} of {days.length} {many} played
            </span>
            <button
              type="button"
              className="rounded-lg bg-[var(--ink-accent)] px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                const open = days.filter((_, i) => state(i) !== 'done')
                const pool = open.length ? open : days
                router.push(`${url}?d=${pool[Math.floor(Math.random() * pool.length)]}`)
              }}
            >
              Random
            </button>
          </div>
          {[...months].map(([month, indexes], m) => (
            <details
              key={month}
              open={m === 0}
              className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-3"
            >
              <summary className="cursor-pointer font-semibold">{monthFormat.format(new Date(month + '-01'))}</summary>
              <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                {indexes.map((i) => {
                  const day = days[i]!
                  return (
                    <li key={day}>
                      <Link
                        className="flex items-center justify-between rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] p-2 text-sm"
                        href={`${url}?d=${day}`}
                        prefetch={false}
                      >
                        {dayFormat.format(new Date(day + 'T12:00:00Z'))}
                        <Mark state={state(i)} label={day} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
