'use client'

/**
 * Renders the daily Connections puzzle with day-by-day archive navigation (?d=YYYY-MM-DD).
 * Each day's game saves in localStorage, so a refresh resumes it and a finished day stays finished.
 * Today's result goes to the player's Scores board, with their rank in the group shown below the game.
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
  dailyScore,
  dailyPuzzle,
  loadDailyBank,
  loadDailyProgress,
  resolveDailyDate,
  saveDailyProgress,
} from '@/lib/connections-daily'
import { boardName, formatScore, localDay, logResult, PUBLIC_GROUP, type BoardRow } from '@/lib/results'
import { PlayerForm, standings, usePlayer, type Standing } from '@/components/Scores'
import ConnectionsBoard, { type ConnectionsCompletePayload } from '@/components/connections/ConnectionsBoard'
import ConnectionsResult from '@/components/connections/ConnectionsResult'

const BASE = '/games/connections'
const muted = { color: 'var(--ink-muted)' }
const accent = { color: 'var(--ink-accent)' }

/**
 * Lets the player enter a name and group, logs today's score once the game ends, and shows their rank.
 */
function DailyScores({ score }: { score: number | null }) {
  const player = usePlayer()
  const [editing, setEditing] = useState(false)
  const [rank, setRank] = useState<{ me: Standing; place: number; count: number } | null>(null)

  useEffect(() => {
    if (!player || score === null) return
    let live = true
    void logResult('connections', score)
      .then(() => fetch(`/api/results?group=${encodeURIComponent(player.group)}&days=90`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rows: BoardRow[] } | null) => {
        if (!live || !d) return
        const table = standings(
          d.rows.filter((r) => r.game === 'connections'),
          localDay(),
        )
        const place = table.findIndex((s) => s.name === player.name)
        if (place >= 0) setRank({ me: table[place]!, place: place + 1, count: table.length })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [player, score])

  if (!player || editing)
    return (
      <div className="space-y-2" data-testid="connections-daily-join">
        <p className="text-sm" style={muted}>
          Enter a name to put today&apos;s result on the leaderboard and compete with everyone who plays.
        </p>
        <PlayerForm player={player} onDone={() => setEditing(false)} />
      </div>
    )

  return (
    <div className="space-y-1 text-sm" data-testid="connections-daily-scores">
      {score !== null && rank && (
        <p className="font-semibold" style={{ color: 'var(--ink-text)' }} data-testid="connections-daily-rank">
          #{rank.place} of {rank.count} today {player.group === PUBLIC_GROUP ? 'on' : 'in'} {boardName(player.group)} · score {formatScore(score)} · 7-day average{' '}
          {formatScore(rank.me.week ?? score)} · {rank.me.wins} {rank.me.wins === 1 ? 'day' : 'days'} won
        </p>
      )}
      <p style={muted}>
        Playing as {player.name} · {boardName(player.group)} ·{' '}
        <button type="button" className="underline" style={accent} onClick={() => setEditing(true)}>
          change
        </button>{' '}
        ·{' '}
        <Link href="/leaderboards" className="underline" style={accent}>
          See the leaderboard
        </Link>
      </p>
    </div>
  )
}

function DailyGame({ date, puzzle, today }: { date: string; puzzle: ConnectionsPuzzle; today: boolean }) {
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
      {today && (
        <DailyScores
          score={result && dailyScore(result.won, result.wrongGuesses, result.solvedDifficulties.length)}
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
      <DailyGame key={date} date={date} puzzle={puzzle} today={date === now} />
    </div>
  )
}
