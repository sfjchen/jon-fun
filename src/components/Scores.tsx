'use client'

/**
 * Renders the leaderboard as 1 scroll: the picked day's score grid, whose game icons filter the page to 1 game,
 * the standings by daily wins, and the player's own stats (streaks, month calendar colored by player, device split)
 * behind 1 disclosure.
 */

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DailyHeader } from '@/components/daily/DailyDrawer'
import { Info, icon } from '@/components/daily/DayNav'
import DayPicker from '@/components/daily/DayPicker'
import { HomeLink } from '@/components/HomeLink'
import { PencilIcon } from '@/components/PlayerName'
import ScoreTable from '@/components/daily/ScoreTable'
import {
  ADMIN_NAME,
  GAMES,
  SHELVES,
  shelfOf,
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

const card = 'rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg)] p-3 sm:p-4'
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
  game,
  me,
  day,
  color,
  onPick,
}: {
  rows: BoardRow[]
  game: Tab
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
    const { names, gameWins } = overallDay(dayRows, game)
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
    <section className="max-w-sm" aria-label="Calendar">
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
 * Compares the player's results by device kind: days played, then each game's average (solve time for Connections)
 * and play count per device, with the better average in bold. Results from before devices were tagged show as Unknown.
 */
function DeviceSplit({ rows, games }: { rows: BoardRow[]; games: GameId[] }) {
  const kinds = [
    ...DEVICE_KINDS.filter((k) => rows.some((r) => r.device === k)),
    ...(rows.some((r) => !r.device) ? ['unknown'] : []),
  ]
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
      <h3 className="text-sm font-semibold">Your averages by device</h3>
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
  const today = siteDay()
  const day = asked && validDay(asked) && asked >= FIRST_DAY ? asked : today
  const game = params.get('game')
  // The page shows 1 shelf at a time: Daily, or Beta with `?shelf=beta` or a Beta game in `?game=`.
  const linked = game && game in GAMES ? (game as GameId) : null
  const shelf = params.get('shelf') === 'beta' || (linked && shelfOf(linked) === 'beta') ? 'beta' : 'daily'
  const ids = SHELVES[shelf].ids
  const [picked, setTab] = useState<Tab>(linked ?? 'all')
  // A game picked on the other shelf does not carry over when the shelf changes.
  const tab: Tab = picked !== 'all' && ids.includes(picked) ? picked : 'all'
  const [span, setSpan] = useState<30 | 0>(30)
  const [copied, setCopied] = useState(false)
  const group = player?.group ?? PUBLIC_GROUP
  const board = useBoard(group, 6000, day)
  const { legacyRows, loaded, error } = board
  // Every number on the page (wins, streaks, calendar, stats) counts this shelf's games only.
  const rows = board.rows.filter((r) => ids.includes(r.game))

  // Results saved on this device sync on load and on every live refresh, and a synced one reloads the board.
  useEffect(() => {
    const sync = () => void flushResults()
    sync()
    return onLiveRefresh(sync)
  }, [group])

  const color = playerColors(rows, me)
  const games = tab === 'all' ? ids : [tab]
  const shown = rows.filter((r) => games.includes(r.game))
  const dayRows = rows.filter((r) => r.day === day)
  const since = span ? shiftDay(day, 1 - span) : DAILY_EPOCH
  const windowRows = shown.filter((r) => r.day >= since && r.day <= day)
  const q = day === today ? '' : `?d=${day}`
  /** Opens the leaderboard on another day. */
  const beta = shelf === 'beta' ? '&shelf=beta' : ''
  const pick = (d: string) => router.push(`/leaderboards?d=${d}${beta}`, { scroll: false })

  // The standings rows for the window and picked game, most daily wins first.
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
  const mineToday = dayRows.filter((r) => r.name === me)
  // Streaks count every game like the Daily drawer, regardless of the active filter.
  const mineAll = rows.filter((r) => r.name === me && r.day <= day)
  const streak = streaks(mineAll, day)
  const overall = overallDay(dayRows)
  const lead = overall.gameWins.get(overall.names[0] ?? '')
  // Friends who played in the last week and have yet to play today.
  const waiting =
    day === today
      ? [...new Set(rows.filter((r) => r.day >= shiftDay(day, -7) && r.name !== me).map((r) => r.name))].filter(
          (n) => !rows.some((r) => r.day === day && r.name === n),
        )
      : []
  const ranked = tab === 'all' ? [] : dayRows.filter((r) => r.game === tab).sort(compareResults)
  const top = winners(ranked)
  /** Formats a standings average or best in the picked game's unit. */
  const metric = (value: number | null) =>
    value === null
      ? '—'
      : tab === 'connections'
        ? formatTime(Math.round(value))
        : tab === 'all'
          ? String(value)
          : formatGameScore(tab, value)
  return (
    <div
      className="scores-hub mx-auto max-w-xl space-y-4"
      data-testid="scores-hub"
      // A picked game lends the page its accent, as on that game's own page.
      style={
        tab === 'all'
          ? undefined
          : ({ '--game-color': `var(--g-${tab})`, '--ink-accent': `var(--g-${tab})` } as React.CSSProperties)
      }
    >
      <header className="space-y-1 border-b border-[var(--ink-border)] pb-2">
        <div className="daily-heading flex min-h-12 items-center gap-1 sm:gap-2">
          <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
          <h1 className="mr-auto min-w-0 truncate font-lora text-xl font-bold md:text-2xl">Leaderboard</h1>
          <DailyHeader compact shelf={shelf} />
          {mineToday.length > 0 && (
            <button
              type="button"
              className={icon}
              aria-label="Copy my results"
              title={copied ? 'Copied' : 'Copy my results'}
              onClick={() =>
                void navigator.clipboard
                  .writeText(
                    [`sfjc.dev · ${day}`, ...mineToday.map((r) => `${GAMES[r.game].title}: ${resultLabel(r)}`)].join(
                      '\n',
                    ),
                  )
                  .then(
                    () => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1500)
                    },
                    () => {},
                  )
              }
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                {copied ? (
                  <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M9 9h10v11H9zM15 9V4H5v11h4" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          )}
          <Info>
            <ul className="space-y-2">
              {ids.map((g) => (
                <li key={g}>
                  <strong>{GAMES[g].title}:</strong> {GAMES[g].rules}
                </li>
              ))}
            </ul>
            <p>
              Daily and Beta are scored apart. Within each, every game counts the same toward overall daily wins and
              streaks. A game win needs 2 players that day. Equal results share the rank.
            </p>
          </Info>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <DayPicker day={day} today={today} minDay={FIRST_DAY} maxDay={today} go={pick} keys />
          <div role="tablist" aria-label="Shelf" className="mr-auto flex rounded-full bg-[var(--ink-paper)] p-0.5">
            {(['daily', 'beta'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === shelf}
                title={s === 'beta' ? 'Games still being built' : 'The 6 daily games'}
                onClick={() =>
                  router.push(`/leaderboards?d=${day}${s === 'beta' ? '&shelf=beta' : ''}`, { scroll: false })
                }
                className={
                  'rounded-full px-3 py-1 text-xs font-semibold ' +
                  (s === shelf ? 'bg-[var(--ink-text)] text-[var(--ink-bg)]' : muted)
                }
              >
                {SHELVES[s].title}
              </button>
            ))}
          </div>
          <button
            type="button"
            title="Edit name and group"
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
            className={
              'inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-[var(--ink-border)] px-2.5 ' +
              'text-xs hover:bg-[var(--ink-paper)]'
            }
          >
            {player ? (
              <>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(me) }} />
                <span data-testid="device-player-name" className="max-w-32 truncate font-medium">
                  {me}
                </span>
                {group !== PUBLIC_GROUP && <span className={muted}>{boardName(group)}</span>}
              </>
            ) : (
              'Add your name'
            )}
            <PencilIcon />
          </button>
        </div>
      </header>
      {editing && (
        <PlayerForm key={`${player?.name}:${player?.group}`} player={player} onDone={() => setEditing(false)} />
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 p-3 text-sm">
          {error}
        </p>
      )}
      {!loaded && !error && (
        <div role="status" aria-label="Loading results" className={`${card} animate-pulse space-y-2`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-md bg-[var(--ink-border)]/40" />
          ))}
        </div>
      )}
      {loaded && (
        <section id="day-results" aria-label="Day results" className="scroll-mt-4 space-y-2">
          {(overall.names.length > 0 || streak.current > 0 || waiting.length > 0) && (
            <div className="flex flex-wrap items-baseline gap-x-3 px-1 text-sm">
              {overall.names.length > 0 && (
                <p className="font-semibold">
                  👑 {overall.names.join(' & ')}
                  <span className={`ml-1.5 font-normal ${muted}`}>
                    {lead} {lead === 1 ? 'win' : 'wins'}
                    {overall.names.length > 1 && ' each'}
                  </span>
                </p>
              )}
              {waiting.length > 0 && (
                <p className={`text-xs ${muted}`}>
                  Waiting on {waiting.slice(0, 4).join(', ')}
                  {waiting.length > 4 && ` +${waiting.length - 4}`}
                </p>
              )}
              {streak.current > 0 && (
                <span
                  role="img"
                  className="ml-auto tabular-nums"
                  title={`${streak.current} day streak`}
                  aria-label={`${streak.current} day streak`}
                >
                  🔥{streak.current}
                </span>
              )}
            </div>
          )}
          {dayRows.length ? (
            <div className={card}>
              <div className="mb-1 flex items-baseline justify-between gap-2 px-2">
                <h2 className="text-sm font-semibold">{day === today ? 'Today' : 'Scores'}</h2>
                <p className={`text-xs ${muted}`}>
                  {tab === 'all' ? 'Tap a game icon for its board' : 'Tap the icon again for all games'}
                </p>
              </div>
              <ScoreTable
                rows={dayRows}
                me={me}
                q={q}
                wins={overall.gameWins}
                color={color}
                game={tab}
                onGame={(g) => setTab(tab === g ? 'all' : g)}
                games={ids}
              />
              {tab !== 'all' && (
                <div className="mt-3 border-t border-[var(--ink-border)] pt-3">
                  <Link href={GAMES[tab].url + q} className="px-2 text-sm font-semibold text-[var(--ink-accent)]">
                    {GAMES[tab].title} ↗
                  </Link>
                  {ranked.length ? (
                    <ol className="mt-1">
                      {ranked.map((r) => (
                        <li
                          key={r.name}
                          className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${r.name === me ? 'bg-[var(--ink-paper)]' : ''}`}
                        >
                          <span className={`w-5 text-right tabular-nums ${muted}`}>
                            {ranked.findIndex((other) => compareResults(other, r) === 0) + 1}
                          </span>
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color(r.name) }}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                          {top.includes(r.name) && (
                            <span className="text-xs text-amber-700" title="Daily winner" aria-label="Daily winner">
                              ★
                            </span>
                          )}
                          {r.conflict && (
                            <span
                              className="text-xs text-amber-700"
                              title={`Also played on another device (${resultLabel({ ...r, ...r.conflict })}). The first result counts.`}
                            >
                              ⚠
                            </span>
                          )}
                          <span className="text-right tabular-nums">{resultLabel(r)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={`px-2 py-3 text-sm ${muted}`}>No results yet.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={`${card} space-y-3 py-6 text-center sm:py-8`}>
              <p className="text-sm">{day === today ? 'Nobody has played yet. Be first.' : 'No scores this day.'}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {ids.map((g) => (
                  <Link
                    key={g}
                    href={GAMES[g].url + q}
                    aria-label={`Play ${GAMES[g].title}`}
                    title={GAMES[g].title}
                    className="rounded-lg p-1 hover:bg-[var(--ink-paper)]"
                  >
                    <Image src={`/doodles/notebook/${g}.svg`} alt="" width={32} height={32} className="h-8 w-8" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      {loaded && table.length > 0 && (
        <section aria-label="Standings" data-testid={tab === 'all' ? 'standings' : `board-${tab}`} className={card}>
          <div className="mb-1 flex items-center justify-between px-2">
            <h2 className="text-sm font-semibold">
              Standings
              {tab !== 'all' && <span className={`font-normal ${muted}`}> · {GAMES[tab].title}</span>}
            </h2>
            <button
              type="button"
              className={`-mr-2 px-2 py-2 text-xs underline ${muted}`}
              aria-label={`Show ${span ? 'all time' : 'last 30 days'}`}
              onClick={() => setSpan(span ? 0 : 30)}
            >
              {span ? 'Last 30 days' : 'All time'} ⇄
            </button>
          </div>
          <ol>
            {table.map((p) => {
              // Ties share a rank, and a medal shows only while everyone tied for it still fits on the podium.
              const rank = table.findIndex((o) => o.wins === p.wins) + 1
              const podium = p.wins > 0 && table.filter((o) => o.wins >= p.wins).length <= 3
              return (
                <li
                  key={p.name}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${p.name === me ? 'bg-[var(--ink-paper)]' : ''}`}
                >
                  <span className={`w-6 shrink-0 text-center tabular-nums ${muted}`}>
                    {podium ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                  </span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(p.name) }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center font-medium">
                      <span className="truncate">{p.name}</span>
                      {player && me.toLowerCase() === ADMIN_NAME && <PlayerAdmin player={player} name={p.name} />}
                    </span>
                    {tab !== 'all' && (
                      <span className={`block text-xs ${muted}`}>
                        avg {metric(p.avg)} · best {metric(p.best)}
                      </span>
                    )}
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="font-semibold">{p.wins}</span>
                    <span className={muted}>
                      {' '}
                      {p.wins === 1 ? 'win' : 'wins'} · {p.played} {tab === 'all' ? 'day' : 'game'}
                      {p.played === 1 ? '' : 's'}
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}
      {loaded && me && rows.some((r) => r.name === me) && (
        <section aria-label="Your stats" className={card}>
          <h2 className="px-2 text-sm font-semibold">
            Your stats
            {tab !== 'all' && <span className={`font-normal ${muted}`}> · {GAMES[tab].title}</span>}
          </h2>
          <div className="mt-3 space-y-5 px-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Days played', new Set(mineAll.map((r) => r.day)).size],
                ['Current streak', streak.current],
                ['Longest streak', streak.longest],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-[var(--ink-border)] bg-[var(--ink-paper)] px-1 py-3"
                >
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
                  <p className={`mt-1 text-xs ${muted}`}>{label}</p>
                </div>
              ))}
            </div>
            {tab !== 'all' && <Trend rows={mine} day={day} />}
            <Calendar
              rows={tab === 'all' ? rows : shown}
              game={tab}
              me={me}
              day={day}
              color={color}
              onPick={(d) => {
                pick(d)
                document.getElementById('day-results')?.scrollIntoView({ behavior: 'smooth' })
              }}
            />
            {tab === 'all' && mineAll.some((r) => r.device) && <DeviceSplit rows={mineAll} games={ids} />}
            {tab !== 'all' && mine.some((r) => r.device) && <DeviceSplit rows={mine} games={games} />}
          </div>
        </section>
      )}
      <footer className={`space-y-2 px-1 text-xs ${muted}`}>
        <Link href="/leaderboards?tab=multiplayer" className="inline-block py-2 underline">
          Multiplayer: 24 and Set →
        </Link>
        {!!legacyRows.length && (
          <details>
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
      </footer>
    </div>
  )
}
