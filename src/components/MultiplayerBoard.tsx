'use client'

/**
 * Multiplayer leaderboard for 24 and SET race rooms: wins, win rate and games played, plus 24 solve times.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { MatchRow } from '@/app/api/match-results/route'
import { HomeLink } from '@/components/HomeLink'
import { getDevicePlayer } from '@/lib/syncIdentity'

const GAMES = [
  { id: '24', label: '24', href: '/games/24' },
  { id: 'set', label: 'Set', href: '/games/triples' },
]
/**
 * Formats milliseconds as seconds, or a dash when missing.
 */
const sec = (ms: number | null) => (ms == null ? '-' : `${(ms / 1000).toFixed(1)}s`)

/**
 * Loads and renders the table for the chosen game and window.
 */
export function MultiplayerBoard() {
  const [game, setGame] = useState(GAMES[0]!)
  const [days, setDays] = useState(30)
  const [res, setRes] = useState<{ key: string; rows: MatchRow[]; me: string } | null>(null)
  const key = `${game.id}:${days}`
  useEffect(() => {
    let live = true
    fetch(`/api/match-results?game=${key.split(':')[0]}&days=${days}`)
      .then((r) => r.json())
      .then((d) => d.rows ?? [])
      .catch(() => [])
      .then((rows) => live && setRes({ key, rows, me: getDevicePlayer()?.name.trim().toLowerCase() ?? '' }))
    return () => {
      live = false
    }
  }, [key, days])
  const rows = res?.key === key ? res.rows : null
  const me = res?.me ?? ''
  const pill = (on: boolean) =>
    'h-9 rounded-full border px-3.5 text-xs font-medium ' +
    (on
      ? 'border-transparent bg-[var(--ink-text)] text-[var(--ink-bg)]'
      : 'border-[var(--ink-border)] hover:bg-[var(--ink-paper)]')
  const is24 = game.id === '24'
  return (
    <section className="scores-hub mx-auto max-w-xl space-y-4">
      <header className="daily-heading flex min-h-12 items-center gap-1 border-b border-[var(--ink-border)] sm:gap-2">
        <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
        <h1 className="mr-auto min-w-0 truncate font-lora text-xl font-bold md:text-2xl">Multiplayer</h1>
      </header>
      <div className="flex items-center gap-1.5">
        {GAMES.map((g) => (
          <button
            key={g.id}
            aria-pressed={g.id === game.id}
            onClick={() => setGame(g)}
            className={pill(g.id === game.id)}
          >
            {g.label}
          </button>
        ))}
        <button
          className="ml-auto px-2 py-2 text-xs text-[var(--ink-muted)] underline"
          aria-label={`Show ${days ? 'all time' : 'last 30 days'}`}
          onClick={() => setDays(days ? 0 : 30)}
        >
          {days ? 'Last 30 days' : 'All time'} ⇄
        </button>
      </div>
      {rows && !rows.length ? (
        <p className="text-[var(--ink-muted)]">
          No finished matches yet. Play a room of{' '}
          <Link className="underline" href="/games/24">
            24
          </Link>{' '}
          or{' '}
          <Link className="underline" href="/games/triples">
            Set
          </Link>{' '}
          with friends.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--ink-border)] p-2 sm:p-3">
          <table className="w-full text-left text-sm tabular-nums [&_td]:px-2 [&_td]:py-2.5 [&_th]:px-2 [&_th]:py-2 [&_th]:font-normal">
            <thead className="text-xs text-[var(--ink-muted)]">
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Wins</th>
                <th className="hidden sm:table-cell">Win %</th>
                <th>Games</th>
                {is24 ? (
                  <>
                    <th>Best</th>
                    <th>Avg</th>
                  </>
                ) : (
                  <th>Sets</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r, i) => (
                <tr key={r.name} className={r.name.toLowerCase() === me ? 'bg-[var(--ink-paper)]' : ''}>
                  <td className="rounded-l-lg text-[var(--ink-muted)]">
                    {(r.wins > 0 && ['🥇', '🥈', '🥉'][i]) || i + 1}
                  </td>
                  <td className="font-medium">{r.name}</td>
                  <td className="font-semibold">{r.wins}</td>
                  <td className="hidden sm:table-cell">{Math.round(r.winRate * 100)}%</td>
                  <td>{r.played}</td>
                  {is24 ? (
                    <>
                      <td>{sec(r.bestMs)}</td>
                      <td>{sec(r.avgMs)}</td>
                    </>
                  ) : (
                    <td>{r.sets}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link href="/leaderboards" className="inline-block px-1 py-2 text-xs text-[var(--ink-muted)] underline">
        ← Daily leaderboard
      </Link>
    </section>
  )
}
