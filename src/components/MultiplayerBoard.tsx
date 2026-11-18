'use client'

/**
 * Multiplayer leaderboard for 24 and SET race rooms: wins, win rate and games played, plus 24 solve times.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { MatchRow } from '@/app/api/match-results/route'
import { HomeLink } from '@/components/HomeLink'
import { getDevicePlayer } from '@/lib/syncIdentity'

const GAMES = [{ id: '24', label: '24', href: '/games/24' }, { id: 'set', label: 'SET', href: '/games/triples' }]
const WINDOWS = [{ days: 30, label: '30 days' }, { days: 0, label: 'All time' }]

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
    return () => { live = false }
  }, [key, days])
  const rows = res?.key === key ? res.rows : null
  const me = res?.me ?? ''
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1 text-sm ${on ? 'bg-[var(--ink-accent)] text-white' : 'border border-[var(--ink-border)]'}`
  const is24 = game.id === '24'
  return (
    <section className="mx-auto max-w-4xl space-y-3">
      <header className="flex items-center gap-2">
        <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
        <h1 className="font-lora text-2xl font-bold sm:text-3xl">Multiplayer leaderboard</h1>
      </header>
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          {GAMES.map((g) => <button key={g.id} onClick={() => setGame(g)} className={pill(g.id === game.id)}>{g.label}</button>)}
        </div>
        <div className="flex gap-2">
          {WINDOWS.map((w) => <button key={w.days} onClick={() => setDays(w.days)} className={pill(w.days === days)}>{w.label}</button>)}
        </div>
      </div>
      {rows && !rows.length ? (
        <p className="text-[var(--ink-muted)]">
          No finished matches yet. Play a room of <Link className="underline" href="/games/24">24</Link> or{' '}
          <Link className="underline" href="/games/triples">SET</Link> with friends.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-[var(--ink-muted)]">
            <tr>
              <th className="py-1">#</th><th>Player</th><th>Wins</th><th>Win %</th><th>Games</th>
              {is24 ? <><th>Best</th><th>Avg</th></> : <th>Sets</th>}
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r, i) => (
              <tr key={r.name} className={`border-t border-[var(--ink-border)] ${r.name.toLowerCase() === me ? 'bg-[var(--ink-paper)] font-semibold' : ''}`}>
                <td className="py-1.5">{i + 1}</td><td>{r.name}</td><td>{r.wins}</td>
                <td>{Math.round(r.winRate * 100)}%</td><td>{r.played}</td>
                {is24 ? <><td>{sec(r.bestMs)}</td><td>{sec(r.avgMs)}</td></> : <td>{r.sets}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
