'use client'

/**
 * Renders the leaderboard: a game filter, a month calendar colored by player, the picked day's
 * results, a standings table (games played, average, best, wins) and the player's own stats, split by device.
 */

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Info } from '@/components/daily/DayNav'
import DayPicker from '@/components/daily/DayPicker'
import { HomeLink } from '@/components/HomeLink'
import PlayerName, { PencilIcon } from '@/components/PlayerName'
import {
  ADMIN_NAME,
  GAMES,
  GAME_IDS,
  PUBLIC_GROUP,
  bestGameScore,
  boardChanged,
  boardName,
  compareResults,
  flushResults,
  formatGameScore,
  formatScore,
  formatTime,
  onLiveRefresh,
  resultLabel,
  setPlayer,
  type BoardRow,
  type GameId,
  type Player,
} from '@/lib/results'
import { DAILY_EPOCH, FIRST_DAY, shiftDay, siteDay, validDay } from '@/lib/daily'
import { usePlayer } from '@/lib/use-player'
import { useBoard } from '@/lib/use-board'
import { average, overallDay, streaks, winners, winsByPlayer } from '@/lib/score-stats'
import { DEVICE_KINDS } from '@/lib/syncIdentity'
import { useHoverTip } from '@/components/HoverTip'

const card = 'rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-bg)] p-3 shadow-sm sm:p-4'
const muted = 'text-[var(--ink-muted)]'
type Tab = GameId | 'all'

/**
 * Admin controls beside a player's name in Standings: rename the player, or remove them with all their results.
 * Shown only to a device playing as the admin name, and the server checks that device again.
 */
function PlayerAdmin({ player, name }: { player: Player; name: string }) {
  const send = async (change: { action: 'rename'; to: string } | { action: 'remove' }) => {
    const r = await fetch('/api/sync/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...change, group: player.group, name }),
    }).catch(() => null)
    const d = (await r?.json().catch(() => null)) as { error?: string; name?: string } | null
    if (!r?.ok) return window.alert(d?.error ?? 'Could not change this player')
    // Renaming the admin's own name moves this device with it.
    if (d?.name && name === player.name) setPlayer({ ...player, name: d.name })
    boardChanged()
  }
  const button = 'rounded px-1 text-xs font-normal opacity-50 hover:bg-[var(--ink-paper)] hover:opacity-100'
  return (
    <span className="ml-1 flex gap-0.5">
      <button
        type="button"
        className={button}
        title={`Rename ${name}`}
        aria-label={`Rename ${name}`}
        onClick={() => {
          const to = window.prompt(`Rename ${name} to`, name)?.trim().slice(0, 24)
          if (to && to !== name) void send({ action: 'rename', to })
        }}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className={button}
        title={`Remove ${name}`}
        aria-label={`Remove ${name}`}
        onClick={() => {
          if (window.confirm(`Remove ${name} and all their results from this board? This cannot be undone.`))
            void send({ action: 'remove' })
        }}
      >
        ✕
      </button>
    </span>
  )
}

/**
 * Collects the name and, optionally, a private group code that results are filed under.
 */
function PlayerForm({ player, onDone }: { player: Player | null; onDone: () => void }) {
  const [name, setName] = useState(player?.name ?? '')
  const [group, setGroup] = useState(player && player.group !== PUBLIC_GROUP ? player.group : '')
  const code = group.trim().toLowerCase() || PUBLIC_GROUP
  const ok = name.trim().length > 0 && /^[a-z0-9-]{3,32}$/.test(code)
  const field = 'mt-1 block w-full rounded-lg border bg-[var(--ink-bg)] p-2'
  return (
    <form
      className={`${card} grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end`}
      onSubmit={(e) => {
        e.preventDefault()
        if (!ok) return
        setPlayer({ name: name.trim(), group: code })
        onDone()
      }}
    >
      <label className="text-sm">
        Your name
        <input className={field} value={name} maxLength={24} required onChange={(e) => setName(e.target.value)} />
      </label>
      <label
        className="text-sm"
        title="Friends who type the same code share a private board. Leave empty for the public board."
      >
        Group code <span className={muted}>(optional)</span>
        <input
          className={field}
          value={group}
          maxLength={32}
          placeholder="public"
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(e) => setGroup(e.target.value)}
        />
      </label>
      <button disabled={!ok} className="rounded-lg bg-[var(--ink-accent)] px-5 py-2 text-white disabled:opacity-40">
        Save
      </button>
    </form>
  )
}

/**
 * Draws one player's last 14 days for a game as a small line chart.
 */
function Trend({ rows: all, day }: { rows: BoardRow[]; day: string }) {
  const dates = Array.from({ length: 14 }, (_, i) => shiftDay(day, i - 13))
  // Connections plots solve time, so unfinished runs, which have no ranked time, stay off the chart.
  const rows = all.filter((r) => r.game !== 'connections' || (r.score === 4 && r.stats.seconds !== undefined))
  const value = (r: BoardRow) => (r.game === 'connections' ? (r.stats.seconds ?? 0) : r.score)
  const max = Math.max(1, ...rows.filter((r) => dates.includes(r.day)).map(value))
  const dots = dates.flatMap((d, i) => {
    const r = rows.find((x) => x.day === d)
    return r
      ? [
          {
            x: 15 + i * 24,
            y: r.game === 'connections' || r.game === 'mini' ? 15 + (value(r) / max) * 65 : 85 - (value(r) / max) * 65,
            r,
          },
        ]
      : []
  })
  return (
    <svg viewBox="0 0 345 100" role="img" aria-label="Your last 14 days" className="w-full max-w-xl">
      <path d="M15 15V85H330" fill="none" stroke="var(--ink-border)" />
      {dots.map((d, i) => {
        const prev = dots[i - 1]
        return (
          <g key={d.r.day}>
            {prev && shiftDay(prev.r.day, 1) === d.r.day && (
              <line x1={prev.x} y1={prev.y} x2={d.x} y2={d.y} stroke="var(--ink-accent)" strokeWidth="2" />
            )}
            <circle cx={d.x} cy={d.y} r="4" fill="var(--ink-accent)">
              <title>
                {d.r.day}: {resultLabel(d.r)}
              </title>
            </circle>
          </g>
        )
      })}
      <text x="15" y="98" fontSize="9" fill="currentColor">
        {dates[0]!.slice(5)}
      </text>
      <text x="305" y="98" fontSize="9" fill="currentColor">
        {day.slice(5)}
      </text>
    </svg>
  )
}

/** Player colors, distinct in light and dark themes and dark enough for white day numbers. The viewer gets the first. */
const COLORS = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
const OTHER = '#6b7280'

/**
 * Gives each player on the board a color, in order of days played so the regulars keep the most distinct ones, so a
 * player has the same color in the calendar, rankings and standings.
 */
function playerColors(rows: BoardRow[], me: string): (name: string) => string {
  const days = new Map<string, Set<string>>()
  for (const r of rows) days.set(r.name, (days.get(r.name) ?? new Set()).add(r.day))
  const order = [...days.keys()]
    .filter((n) => n !== me)
    .sort((a, b) => days.get(b)!.size - days.get(a)!.size || a.localeCompare(b))
  if (me) order.unshift(me)
  return (n) => COLORS[order.indexOf(n)] ?? OTHER
}

/**
 * Fills a box with equal hard-edged diagonal slices, 1 per color, so 2 players read as half and half.
 */
function slices(colors: string[]): string | undefined {
  if (colors.length < 2) return colors[0]
  return `linear-gradient(135deg, ${colors.map((c, i) => `${c} ${(i / colors.length) * 100}% ${((i + 1) / colors.length) * 100}%`).join(', ')})`
}

/**
 * Renders the month calendar in 2 views. Played fills each day with the colors of everyone who played it, and Wins
 * with the day's overall winners, so ties split the box evenly. Hovering a day lists who played or won, and hovering
 * a name in the key (or tapping it to pin) fades the days that player missed.
 */
function Calendar({
  rows,
  me,
  day,
  color,
  onPick,
}: {
  rows: BoardRow[]
  me: string
  day: string
  color: (name: string) => string
  onPick: (d: string) => void
}) {
  const [month, setMonth] = useState(day.slice(0, 7))
  const [shown, setShown] = useState(day)
  const [mode, setMode] = useState<'played' | 'wins'>('played')
  const [pinned, setPinned] = useState('')
  const [hovered, setHovered] = useState('')
  const tip = useHoverTip()
  if (shown !== day) {
    setShown(day)
    setMonth(day.slice(0, 7))
  }
  const first = `${month}-01`
  const count = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
  const offset = new Date(`${first}T12:00:00Z`).getUTCDay()
  const today = siteDay()
  const monthRows = rows.filter((r) => r.day.startsWith(month))
  const days = Array.from({ length: count }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`
    const dayRows = monthRows.filter((r) => r.day === d)
    const { names, gameWins } = overallDay(dayRows)
    const played = [...new Set(dayRows.map((r) => r.name))]
    const games = new Map(played.map((n) => [n, dayRows.filter((r) => r.name === n).length]))
    return { d, n: i + 1, who: mode === 'played' ? played : names, games, gameWins }
  })
  const tally = new Map<string, number>()
  for (const x of days) for (const n of x.who) tally.set(n, (tally.get(n) ?? 0) + 1)
  const names = [...new Set(monthRows.map((r) => r.name))].sort(
    (a, b) => Number(b === me) - Number(a === me) || (tally.get(b) ?? 0) - (tally.get(a) ?? 0) || a.localeCompare(b),
  )
  const focus = hovered || pinned
  return (
    <section className={card} aria-label="Calendar">
      <div className="mb-2 flex items-center gap-1">
        <button
          aria-label="Previous month"
          className="h-9 w-9 rounded-lg border border-[var(--ink-border)] hover:bg-[var(--ink-border)]/40 disabled:opacity-30"
          disabled={month <= '2014-08'}
          onClick={() => setMonth(shiftDay(first, -1).slice(0, 7))}
        >
          ‹
        </button>
        <h2 className="min-w-32 text-center font-semibold">
          {new Date(`${first}T12:00:00Z`).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </h2>
        <button
          aria-label="Next month"
          className="h-9 w-9 rounded-lg border border-[var(--ink-border)] hover:bg-[var(--ink-border)]/40 disabled:opacity-30"
          disabled={month >= today.slice(0, 7)}
          onClick={() => setMonth(shiftDay(`${month}-${count}`, 1).slice(0, 7))}
        >
          ›
        </button>
        <div className="ml-auto flex rounded-lg bg-[var(--ink-border)]/35 p-1 text-xs">
          {(['played', 'wins'] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 ${mode === m ? 'bg-[var(--ink-paper)] shadow-sm' : ''}`}
            >
              {m === 'played' ? 'Played' : 'Wins'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className={`py-1 text-xs ${muted}`}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {days.map(({ d, n, who, games, gameWins }) => {
          const ordered = [...who].sort((a, b) => names.indexOf(a) - names.indexOf(b))
          const what = ordered.length
            ? ordered.map((x) => (mode === 'wins' ? `${x} won ${gameWins.get(x)}` : x)).join(', ')
            : 'no scores'
          const fill = slices(ordered.map(color))
          const faded = focus && !who.includes(focus)
          const date = new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
            timeZone: 'UTC',
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
          const detail = (
            <>
              <span className="block font-semibold">{date}</span>
              {games.size ? (
                [...games]
                  .sort((a, b) => names.indexOf(a[0]) - names.indexOf(b[0]))
                  .map(([x, k]) => (
                    <span key={x} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color(x) }} />
                      {x} · {k} {k === 1 ? 'game' : 'games'}
                      {gameWins.get(x) ? ` · ${gameWins.get(x)} won` : ''}
                      {mode === 'wins' && who.includes(x) && ' ★'}
                    </span>
                  ))
              ) : (
                <span className="block">No scores</span>
              )}
            </>
          )
          return (
            <button
              key={d}
              aria-label={`${d}, ${what}`}
              aria-pressed={day === d}
              disabled={d < FIRST_DAY || d > today}
              onClick={() => onPick(d)}
              {...tip.on(detail)}
              style={fill ? { background: fill } : undefined}
              className={`aspect-square rounded-lg leading-none tabular-nums transition-opacity disabled:opacity-30 ${
                fill
                  ? 'font-semibold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)] hover:brightness-110'
                  : 'hover:bg-[var(--ink-border)]/40'
              } ${day === d ? 'ring-2 ring-[var(--ink-text)] ring-offset-2 ring-offset-[var(--ink-bg)]' : d === today ? 'ring-1 ring-[var(--ink-muted)]' : ''} ${
                faded ? 'opacity-25' : ''
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>
      {tip.el}
      {names.length > 0 && (
        <ul
          className="mt-3 flex flex-wrap gap-1.5 text-xs"
          aria-label={`Players, days ${mode === 'played' ? 'played' : 'won'} this month`}
        >
          {names.map((x) => (
            <li key={x}>
              <button
                aria-pressed={pinned === x}
                onClick={() => setPinned(pinned === x ? '' : x)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(x)}
                onPointerLeave={() => setHovered('')}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${pinned === x ? 'border-[var(--ink-text)]' : 'border-[var(--ink-border)]'}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color(x) }} />
                <span className="max-w-24 truncate">
                  {x}
                  {x === me && ' (you)'}
                </span>
                <span className={`tabular-nums ${muted}`}>{tally.get(x) ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Compares the player's results by device kind: days played, then each game's average and play count per device,
 * with the better average in bold. Results from before devices were tagged show as Unknown.
 */
function DeviceSplit({ rows, games }: { rows: BoardRow[]; games: GameId[] }) {
  const kinds = [
    ...DEVICE_KINDS.filter((k) => rows.some((r) => r.device === k)),
    ...(rows.some((r) => !r.device) ? ['unknown'] : []),
  ]
  if (!rows.some((r) => r.device))
    return (
      <p className={`text-sm ${muted}`}>
        Your scores split by phone and computer starting with the next game you finish on each.
      </p>
    )
  const of = (k: string) => rows.filter((r) => (r.device ?? 'unknown') === k)
  const avg = (g: GameId, k: string) => {
    const own = of(k).filter(
      (r) => r.game === g && (g !== 'connections' || (r.score === 4 && r.stats.seconds !== undefined)),
    )
    return own.length
      ? { v: average(own.map((r) => (g === 'connections' ? r.stats.seconds! : r.score))), n: own.length }
      : null
  }
  const show = (g: GameId, v: number) => (g === 'connections' ? formatTime(Math.round(v)) : formatGameScore(g, v))
  const th = 'px-3 py-2 text-right font-normal capitalize'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={`border-b border-[var(--ink-border)] text-xs ${muted}`}>
          <tr>
            <th className="py-2 text-left font-normal">Game</th>
            {kinds.map((k) => (
              <th key={k} className={th}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[var(--ink-border)]">
            <td className="py-3">Days played</td>
            {kinds.map((k) => (
              <td key={k} className="px-3 text-right tabular-nums">
                {new Set(of(k).map((r) => r.day)).size}
              </td>
            ))}
          </tr>
          {games
            .filter((g) => rows.some((r) => r.game === g))
            .map((g) => {
              const cells = kinds.map((k) => avg(g, k))
              const known = cells.filter((c, i) => c && kinds[i] !== 'unknown').map((c) => c!.v)
              const lower = g === 'connections' || GAMES[g].lowerIsBetter
              const top = known.length > 1 ? (lower ? Math.min(...known) : Math.max(...known)) : null
              return (
                <tr key={g} className="border-b border-[var(--ink-border)]">
                  <td className="py-3">{GAMES[g].title}</td>
                  {cells.map((c, i) => (
                    <td
                      key={kinds[i]}
                      className={`px-3 text-right tabular-nums ${c && c.v === top && kinds[i] !== 'unknown' ? 'font-semibold' : ''}`}
                    >
                      {c ? (
                        <>
                          {show(g, c.v)}
                          <span className={`block text-xs font-normal ${muted}`}>
                            {c.n} {c.n === 1 ? 'game' : 'games'}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
        </tbody>
      </table>
      <p className={`mt-2 text-xs ${muted}`}>
        Averages per device. Connections uses solve time. Bold marks the better device.
      </p>
    </div>
  )
}

/**
 * Renders the leaderboard page.
 */
export function ScoresHub() {
  const params = useSearchParams()
  const router = useRouter()
  const player = usePlayer()
  const me = player?.name ?? ''
  const [editing, setEditing] = useState(false)
  const asked = params.get('d')
  const day = asked && validDay(asked) && asked >= FIRST_DAY ? asked : siteDay()
  const game = params.get('game')
  const [tab, setTab] = useState<Tab>(() => (GAME_IDS.includes(game as GameId) ? (game as GameId) : 'all'))
  const [view, setView] = useState<'day' | 'standings' | 'stats'>('day')
  const [span, setSpan] = useState<30 | 0>(30)
  const [copied, setCopied] = useState(false)
  const group = player?.group ?? PUBLIC_GROUP
  const { rows, legacyRows, loaded, error } = useBoard(group, 6000, day)

  // Results saved on this device sync on load and on every live refresh, and a synced one reloads the board.
  useEffect(() => {
    const sync = () => void flushResults()
    sync()
    return onLiveRefresh(sync)
  }, [group])

  const color = playerColors(rows, me)
  const games = tab === 'all' ? GAME_IDS : [tab]
  const shown = rows.filter((r) => games.includes(r.game))
  const picked = shown.filter((r) => r.day === day)
  const since = span ? shiftDay(day, 1 - span) : DAILY_EPOCH
  const windowRows = shown.filter((r) => r.day >= since && r.day <= day)
  const pick = (d: string) => {
    router.push(`/leaderboards?d=${d}`, { scroll: false })
    setCopied(false)
  }

  const table = (() => {
    const wins = winsByPlayer(windowRows)
    return [...new Set(windowRows.map((r) => r.name))]
      .map((name) => {
        const own = windowRows.filter((r) => r.name === name)
        // Wordle scores are 7 minus guesses, so a loss (0) averages in as 7 guesses, as Wordle stat trackers count it.
        const scores =
          tab === 'connections'
            ? own.filter((r) => r.score === 4 && r.stats.seconds !== undefined).map((r) => r.stats.seconds!)
            : own.map((r) => r.score)
        return {
          name,
          played: tab === 'all' ? new Set(own.map((r) => r.day)).size : own.length,
          avg: tab === 'all' || !scores.length ? null : average(scores),
          best:
            tab === 'all' || !scores.length
              ? null
              : tab === 'connections'
                ? Math.min(...scores)
                : bestGameScore(tab, scores),
          wins: wins.get(name) ?? 0,
        }
      })
      .sort((a, b) => b.wins - a.wins || b.played - a.played || a.name.localeCompare(b.name))
  })()

  const mine = shown.filter((r) => r.name === me && r.day <= day)
  const mineToday = rows.filter((r) => r.name === me && r.day === day)
  const streak = streaks(mine, day)
  const overall = overallDay(rows.filter((r) => r.day === day))
  const dayLabel =
    day === siteDay()
      ? 'Today'
      : new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const metricLabel = tab === 'connections' || tab === 'mini' ? 'Solve time' : tab === 'fivefold' ? 'Guesses' : 'Points'
  const metric = (value: number | null) =>
    value === null
      ? '—'
      : tab === 'connections'
        ? formatTime(Math.round(value))
        : tab === 'all'
          ? String(value)
          : formatGameScore(tab, value)
  const ranking = (g: GameId, values: BoardRow[], compact = false) => {
    const ranked = [...values].sort(compareResults),
      top = winners(values)
    return ranked.length ? (
      <ol className="divide-y divide-[var(--ink-border)]">
        {(compact ? ranked.slice(0, 3) : ranked).map((r) => {
          const rank = ranked.findIndex((other) => compareResults(other, r) === 0) + 1
          return (
            <li
              key={r.name}
              className={`flex items-center gap-3 rounded-lg px-2 py-3 text-sm ${r.name === me ? 'bg-[var(--ink-border)]/30' : ''}`}
            >
              <span className={`w-5 text-right tabular-nums ${muted}`}>{rank}</span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(r.name) }} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {r.name}
                {r.name === me && <span className={`ml-1 text-xs font-normal ${muted}`}>(you)</span>}
              </span>
              {top.includes(r.name) && (
                <span className="text-xs text-amber-700" title="Daily winner" aria-label="Daily winner">
                  ★
                </span>
              )}
              <span className="text-right tabular-nums">{resultLabel(r)}</span>
            </li>
          )
        })}
      </ol>
    ) : (
      <p className={`py-5 text-sm ${muted}`}>
        No results yet.{' '}
        <Link href={`${GAMES[g].url}?d=${day}`} className="underline">
          Play {GAMES[g].title} →
        </Link>
      </p>
    )
  }
  return (
    <div className="scores-hub mx-auto max-w-4xl space-y-5" data-testid="scores-hub">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className={`flex items-center gap-1 text-xs ${muted}`}>
            {boardName(group)}
            <button
              aria-label="Edit leaderboard group"
              title="Edit leaderboard group"
              className="-my-2 h-8 w-8 rounded-full p-2 hover:bg-[var(--ink-border)]/40"
              onClick={() => setEditing((v) => !v)}
            >
              <PencilIcon />
            </button>
          </p>
        </div>
        <PlayerName />
        <Info>
          <ul className="space-y-2">
            {GAME_IDS.map((g) => (
              <li key={g}>
                <strong>{GAMES[g].title}:</strong> {GAMES[g].rules}
              </li>
            ))}
          </ul>
          <p>Daily wins require two players. Equal results share the rank.</p>
        </Info>
      </header>
      {editing && (
        <PlayerForm key={`${player?.name}:${player?.group}`} player={player} onDone={() => setEditing(false)} />
      )}
      <div className="flex flex-wrap items-end gap-3 border-y border-[var(--ink-border)] py-4">
        <label className="mr-auto min-w-40 text-xs text-[var(--ink-muted)]">
          Game
          <select
            aria-label="Game"
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
            className="mt-1 block w-full rounded-lg border border-[var(--ink-border)] bg-[var(--ink-paper)] px-3 py-2 text-sm text-[var(--ink-text)]"
          >
            <option value="all">All games</option>
            {GAME_IDS.map((g) => (
              <option key={g} value={g}>
                {GAMES[g].title}
              </option>
            ))}
          </select>
        </label>
        <DayPicker day={day} today={siteDay()} minDay={FIRST_DAY} maxDay={siteDay()} go={pick} keys />
      </div>
      <nav aria-label="Leaderboard views" className="flex gap-5 border-b border-[var(--ink-border)] text-sm">
        {(
          [
            ['day', 'Daily results'],
            ['standings', 'Standings'],
            ['stats', 'Your stats'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            data-hotkey={String(['day', 'standings', 'stats'].indexOf(id) + 1)}
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={`border-b-2 pb-3 ${view === id ? 'border-[var(--ink-accent)] font-semibold' : 'border-transparent text-[var(--ink-muted)]'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 p-3 text-sm">
          {error}
        </p>
      )}
      {!loaded && !error && (
        <div role="status" aria-label="Loading results" className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-[var(--ink-border)]/50" />
          {view === 'stats' ? (
            <div className="grid max-w-sm grid-cols-7 gap-1">
              {Array.from({ length: 35 }, (_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-[var(--ink-border)]/40" />
              ))}
            </div>
          ) : (
            <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
              {GAME_IDS.map((g) => (
                <div key={g} className="h-32 rounded-xl bg-[var(--ink-border)]/40" />
              ))}
            </div>
          )}
        </div>
      )}
      {loaded && view === 'day' && (
        <section aria-label="Day results" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{dayLabel}</h2>
            {tab === 'all' && overall.names.length > 0 && (
              <span className={`text-xs ${muted}`}>Most wins: {overall.names.join(' & ')}</span>
            )}
          </div>
          {tab === 'all' ? (
            <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
              {GAME_IDS.map((g) => (
                <section key={g} className="min-w-0 rounded-xl border border-[var(--ink-border)] p-4">
                  <Link
                    href={`${GAMES[g].url}?d=${day}`}
                    className="flex items-center justify-between text-sm font-semibold"
                  >
                    {GAMES[g].title}
                    <span className={muted}>↗</span>
                  </Link>
                  {ranking(
                    g,
                    picked.filter((r) => r.game === g),
                    true,
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--ink-border)] p-4">
              <p className={`mb-2 text-xs ${muted}`}>{GAMES[tab].rules}</p>
              {ranking(tab, picked)}
            </div>
          )}
          {mineToday.length > 0 && (
            <button
              className={`text-xs underline ${muted}`}
              onClick={() =>
                void navigator.clipboard
                  .writeText(
                    [`sfjc.dev · ${day}`, ...mineToday.map((r) => `${GAMES[r.game].title}: ${resultLabel(r)}`)].join(
                      '\n',
                    ),
                  )
                  .then(() => setCopied(true))
              }
            >
              {copied ? 'Copied' : 'Copy my results'}
            </button>
          )}
        </section>
      )}
      {loaded && view === 'standings' && (
        <section
          aria-label="Standings"
          data-testid={tab === 'all' ? 'standings' : `board-${tab}`}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Standings</h2>
            <div className="flex rounded-lg bg-[var(--ink-border)]/35 p-1 text-xs">
              {([30, 0] as const).map((n) => (
                <button
                  key={n}
                  aria-pressed={span === n}
                  onClick={() => setSpan(n)}
                  className={`rounded-md px-3 py-1.5 ${span === n ? 'bg-[var(--ink-paper)] shadow-sm' : ''}`}
                >
                  {n ? '30 days' : 'All time'}
                </button>
              ))}
            </div>
          </div>
          <p className={`text-xs ${muted}`}>Ranked by daily game wins. Each day compares the same puzzle.</p>
          {table.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={`border-b border-[var(--ink-border)] text-xs ${muted}`}>
                  <tr>
                    <th className="py-3 font-normal">Player</th>
                    <th className="p-3 text-right font-normal">Played</th>
                    <th className="p-3 text-right font-normal">Wins</th>
                    {tab !== 'all' && (
                      <>
                        <th className="p-3 text-right font-normal">Avg {metricLabel.toLowerCase()}</th>
                        <th className="p-3 text-right font-normal">Best</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {table.map((p) => (
                    <tr
                      key={p.name}
                      className={`border-b border-[var(--ink-border)] ${p.name === me ? 'font-semibold' : ''}`}
                    >
                      <td className="py-4">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color(p.name) }}
                          />
                          {p.name}
                          {player && me.toLowerCase() === ADMIN_NAME && <PlayerAdmin player={player} name={p.name} />}
                        </span>
                      </td>
                      <td className="p-3 text-right tabular-nums">{p.played}</td>
                      <td className="p-3 text-right tabular-nums">{p.wins}</td>
                      {tab !== 'all' && (
                        <>
                          <td className="p-3 text-right tabular-nums">{metric(p.avg)}</td>
                          <td className="p-3 text-right tabular-nums">{metric(p.best)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={`py-8 text-center text-sm ${muted}`}>No results in this period yet.</p>
          )}
        </section>
      )}
      {loaded && view === 'stats' && (
        <section aria-label="Your stats" className="space-y-5">
          {me && !rows.some((r) => r.name === me) ? (
            <div className={`${card} space-y-4 text-center`}>
              {/* A sample week shows how played days fill with color before there is any history. */}
              <div aria-hidden className="mx-auto grid max-w-64 grid-cols-7 gap-1 opacity-70">
                {[1, 1, 0, 1, 2, 0, 3].map((k, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-md bg-[var(--ink-border)]/40"
                    style={k ? { background: slices([color(me), COLORS[1]!, COLORS[2]!].slice(0, k)) } : undefined}
                  />
                ))}
              </div>
              <p className="text-sm">
                Your days fill in with your color as you play. Friends on the same day share the box.
              </p>
              <div className="flex justify-center gap-2">
                {GAME_IDS.map((g) => (
                  <Link
                    key={g}
                    href={GAMES[g].url}
                    aria-label={`Play ${GAMES[g].title}`}
                    title={GAMES[g].title}
                    className="rounded-lg p-1 hover:bg-[var(--ink-border)]/40"
                  >
                    <Image src={`/doodles/notebook/${g}.svg`} alt="" width={32} height={32} className="h-8 w-8" />
                  </Link>
                ))}
              </div>
            </div>
          ) : me ? (
            <>
              <h2 className="text-lg font-semibold">Your progress</h2>
              <div className="grid grid-cols-3 gap-3 rounded-xl border border-[var(--ink-border)] py-6 text-center">
                {[
                  ['Days played', new Set(mine.map((r) => r.day)).size],
                  ['Current streak', streak.current],
                  ['Longest streak', streak.longest],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
                    <p className={`mt-2 text-xs ${muted}`}>{label}</p>
                  </div>
                ))}
              </div>
              {tab !== 'all' && (
                <div>
                  <h3 className={`mb-3 text-xs ${muted}`}>Last 14 days · {metricLabel.toLowerCase()}</h3>
                  <Trend rows={mine} day={day} />
                </div>
              )}
              <Calendar rows={shown} me={me} day={day} color={color} onPick={pick} />
              <div>
                <h3 className="mb-3 text-lg font-semibold">Phone vs computer</h3>
                <DeviceSplit rows={mine} games={games} />
              </div>
            </>
          ) : (
            <p className={`py-8 text-sm ${muted}`}>Add your name above to track your progress and streaks.</p>
          )}
        </section>
      )}
      {!!legacyRows.length && (
        <details className={`border-t border-[var(--ink-border)] pt-3 text-xs ${muted}`}>
          <summary className="cursor-pointer">Earlier scoring versions ({legacyRows.length})</summary>
          <ul className="mt-2 space-y-1">
            {legacyRows.map((r) => (
              <li key={`${r.game}:${r.day}:${r.name}`}>
                {r.day} · {r.name} · {GAMES[r.game].title}: {formatScore(r.score)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
