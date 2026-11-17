'use client'

/**
 * Renders the daily Connections puzzle with day-by-day archive navigation (?d=YYYY-MM-DD).
 * Each day's game saves in localStorage, so a refresh resumes it and a finished day stays finished.
 */

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { ConnectionsProgress, ConnectionsPuzzle } from '@/lib/connections'
import { buildShareLines } from '@/lib/connections'
import type { DailyBank } from '@/lib/connections-daily'
import {
  addDays,
  dailyDayNum,
  dailyPuzzle,
  loadDailyBank,
  loadDailyProgress,
  resolveDailyDate,
  saveDailyProgress,
} from '@/lib/connections-daily'
import { localDay } from '@/lib/results'
import ConnectionsBoard, { type ConnectionsCompletePayload } from '@/components/connections/ConnectionsBoard'
import ConnectionsResult from '@/components/connections/ConnectionsResult'

const BASE = '/games/connections'

function DailyGame({ date, puzzle }: { date: string; puzzle: ConnectionsPuzzle }) {
  const [initial] = useState(() => loadDailyProgress(date))
  const [result, setResult] = useState<ConnectionsCompletePayload | null>(null)
  const onProgress = useCallback((p: ConnectionsProgress) => saveDailyProgress(date, p), [date])

  return (
    <div className="space-y-6">
      <ConnectionsBoard puzzle={puzzle} initialProgress={initial} onProgress={onProgress} onComplete={setResult} />
      {result && (
        <ConnectionsResult
          title={`${puzzle.title} · ${date}`}
          won={result.won}
          wrongGuesses={result.wrongGuesses}
          shareLines={buildShareLines(new Set(result.solvedDifficulties), result.won)}
          basePath={BASE}
        />
      )}
    </div>
  )
}

export default function ConnectionsDaily() {
  const router = useRouter()
  const params = useSearchParams()
  const [bank, setBank] = useState<DailyBank | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    loadDailyBank().then(setBank, () => setErr(true))
  }, [])

  if (err) return <p className="text-center">Couldn&apos;t load today&apos;s puzzle. Refresh to try again.</p>
  if (!bank)
    return (
      <p className="text-center" data-testid="connections-daily-loading" style={{ color: 'var(--ink-muted)' }}>
        Loading today&apos;s puzzle…
      </p>
    )

  const now = localDay()
  const date = resolveDailyDate(params.get('d'), now)
  const puzzle = dailyPuzzle(date, bank)
  const go = (d: string) => router.replace(d >= now ? `${BASE}/daily` : `${BASE}/daily?d=${d}`, { scroll: false })
  const label = new Date(`${date}T12:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="mx-auto w-full max-w-xl space-y-4" data-testid="connections-daily">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-lora text-xl font-semibold" style={{ color: 'var(--ink-text)' }}>
            Connections #{dailyDayNum(date) + 1}
          </h1>
          <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
            <button
              type="button"
              className="px-1 text-base leading-none disabled:opacity-30"
              aria-label="Previous day"
              disabled={dailyDayNum(date) <= 0}
              onClick={() => go(addDays(date, -1))}
            >
              ‹
            </button>
            <span data-testid="connections-daily-date">{label}</span>
            <button
              type="button"
              className="px-1 text-base leading-none disabled:opacity-30"
              aria-label="Next day"
              disabled={date >= now}
              onClick={() => go(addDays(date, 1))}
            >
              ›
            </button>
          </p>
        </div>
        <Link href={BASE} className="text-sm underline" style={{ color: 'var(--ink-accent)' }}>
          Library
        </Link>
      </div>
      <DailyGame key={date} date={date} puzzle={puzzle} />
    </div>
  )
}
