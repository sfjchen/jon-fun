'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { NYT_FIRST_DAY, siteDay, validDay, type NytGame } from '@/lib/daily'

const games: Record<NytGame, { label: string; path: string }> = {
  fivefold: { label: 'Wordle', path: '/games/wordle' },
  bee: { label: 'Spelling Bee', path: '/games/spelling-bee' },
  mini: { label: 'Mini crossword', path: '/games/mini' },
  connections: { label: 'Connections', path: '/games/connections/daily' },
}
export default function PuzzleArchives() {
  const [kind, setKind] = useState<NytGame>('connections')
  const [dates, setDates] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/puzzle-archives/${kind}/index.json`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error('Archive unavailable')
        const values = (await r.json()) as string[]
        setDates(values)
        setDate(siteDay())
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not load the archive. Please try again.')
      })
    return () => controller.abort()
  }, [kind])
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="font-lora text-3xl">Past NYT puzzles</h1>
      <p className="text-sm">
        Play the original puzzle for its publication date. Missing puzzles are shown as unavailable; another day is
        never substituted.
      </p>
      <div className="flex flex-wrap gap-4">
        <label>
          Game{' '}
          <select
            aria-label="Game"
            className="rounded border bg-[var(--ink-paper)] p-2"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as NytGame)
              setDates([])
              setDate('')
              setError('')
            }}
          >
            {Object.entries(games).map(([id, g]) => (
              <option key={id} value={id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date{' '}
          <input
            type="date"
            aria-label="Date"
            className="rounded border bg-[var(--ink-paper)] p-2"
            value={date}
            min={NYT_FIRST_DAY[kind]}
            max={siteDay()}
            onChange={(e) => {
              if (validDay(e.target.value)) setDate(e.target.value)
            }}
          />
        </label>
        <button
          className="rounded border px-3 py-2"
          disabled={!dates.length}
          onClick={() => setDate(dates[Math.floor(Math.random() * dates.length)] ?? '')}
        >
          Random past puzzle
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {dates.length > 0 && (
        <p className="text-sm text-[var(--ink-muted)]">
          {dates.length.toLocaleString()} saved puzzles · {dates[0]} to {dates.at(-1)}. New published dates load
          directly from NYT.
        </p>
      )}
      {date && date >= NYT_FIRST_DAY[kind] && date <= siteDay() && (
        <Link className="inline-block rounded border p-3 underline" href={`${games[kind].path}?d=${date}`}>
          Play {games[kind].label} for {date}
        </Link>
      )}
      <details>
        <summary className="cursor-pointer">Download dated puzzle lists (contains answers)</summary>
        <div className="mt-3 flex flex-wrap gap-4">
          {[...new Set(dates.map((d) => d.slice(0, 4)))].map((year) => (
            <a key={year} className="underline" href={`/puzzle-archives/${kind}/${year}.json`} download>
              {year} JSON
            </a>
          ))}
          <a className="underline" href={`/puzzle-archives/${kind}/words.json`} download>
            Distinct answer list
          </a>
        </div>
      </details>
      <p className="text-xs text-[var(--ink-muted)]">
        Puzzle source:{' '}
        <a className="underline" href="https://www.nytimes.com/games">
          The New York Times Games
        </a>
        . Historical source details and unavailable dates:{' '}
        <a className="underline" href="/puzzle-archives/manifest.json">
          archive manifest
        </a>
        .
      </p>
    </div>
  )
}
