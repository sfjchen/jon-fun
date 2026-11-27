'use client'

/** Headcount archive list: a completion mark per past party from this device's saved runs, and a random pick. */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { Mark, type PlayState } from '@/components/daily/ScoreTable'
import { runKey } from '@/lib/daily/saved-run'

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
 * Reads how far this device got in a party: 5 locked rooms is done, fewer is started.
 */
function stateOf(day: string): PlayState {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(runKey('headcount', day, day)) ?? 'null')
    return Array.isArray(v) && v.length > 0 ? (v.length >= 5 ? 'done' : 'started') : 'none'
  } catch {
    return 'none'
  }
}

/**
 * Groups past parties by month with their marks, and opens a random unfinished one.
 */
export default function HeadcountArchive({ days }: { days: string[] }) {
  const router = useRouter()
  const marks = useSyncExternalStore(
    subscribe,
    () => days.map(stateOf).join(','),
    () => '',
  ).split(',') as PlayState[]
  const state = (i: number): PlayState => marks[i] || 'none'
  const done = days.filter((_, i) => state(i) === 'done').length
  if (days.length === 0)
    return (
      <p className="rounded-xl bg-[var(--ink-paper)] p-4 text-sm" data-testid="headcount-archive-empty">
        The first party is today&apos;s. Past parties show up here from tomorrow.
      </p>
    )
  const months = new Map<string, number[]>()
  days.forEach((day, i) => months.set(day.slice(0, 7), [...(months.get(day.slice(0, 7)) ?? []), i]))
  return (
    <div className="space-y-3" data-testid="headcount-archive">
      <div className="flex items-center justify-between rounded-xl bg-[var(--ink-paper)] px-4 py-3">
        <span className="text-sm">
          {done} of {days.length} parties played
        </span>
        <button
          type="button"
          className="rounded-lg bg-[var(--ink-accent)] px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            const open = days.filter((_, i) => state(i) !== 'done')
            const pool = open.length ? open : days
            router.push('/games/headcount?d=' + pool[Math.floor(Math.random() * pool.length)])
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
                    href={'/games/headcount?d=' + day}
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
  )
}
