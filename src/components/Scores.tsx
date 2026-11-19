'use client'

/**
 * Renders the leaderboard: a game filter, a month calendar with play and win ticks, the picked day's
 * results, a standings table (games played, average, best, wins) and the player's own stats.
 */

import Link from 'next/link'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Info } from '@/components/daily/DayNav'
import { HomeLink } from '@/components/HomeLink'
import PlayerName, { PencilIcon } from '@/components/PlayerName'
import {
  GAMES,
  GAME_IDS,
  PLAYER_CHANGED,
  PUBLIC_GROUP,
  RESULTS_CHANGED,
  bestGameScore,
  boardName,
  compareResults,
  flushResults,
  formatGameScore,
  formatScore,
  formatTime,
  getPlayer,
  localDay,
  resultLabel,
  setPlayer,
  type BoardRow,
  type GameId,
  type Player,
} from '@/lib/results'
import { DAILY_EPOCH, shiftDay, validDay } from '@/lib/daily'
import { average, overallDay, streaks, winners, winsByPlayer } from '@/lib/score-stats'

const card = 'rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-bg)] p-3 shadow-sm sm:p-4'
const muted = 'text-[var(--ink-muted)]'
const pill = 'shrink-0 rounded-full border px-3 py-1.5 text-sm'
type Tab = GameId | 'all'

/**
 * Subscribes to changes of the saved player, made in this tab or another one.
 */
function subscribe(cb: () => void) {
  window.addEventListener(PLAYER_CHANGED, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(PLAYER_CHANGED, cb)
    window.removeEventListener('storage', cb)
  }
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
      <label className="text-sm" title="Friends who type the same code share a private board. Leave empty for the public board.">
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
function Trend({ rows, day }: { rows: BoardRow[]; day: string }) {
  const dates = Array.from({ length: 14 }, (_, i) => shiftDay(day, i - 13))
  const max = Math.max(1, ...rows.filter((r) => dates.includes(r.day)).map((r) => r.score))
  const dots = dates.flatMap((d, i) => {
    const r = rows.find((x) => x.day === d)
    return r ? [{ x: 15 + i * 24, y: 85 - (r.score / max) * 65, r }] : []
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
                {d.r.day}: {formatGameScore(d.r.game, d.r.score)}
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

/**
 * Renders the month calendar. Each day shows ★ for a win, ✓ for a day you played and · for a day only others played.
 */
function Calendar({
  rows,
  me,
  day,
  onPick,
}: {
  rows: BoardRow[]
  me: string
  day: string
  onPick: (d: string) => void
}) {
  const [month, setMonth] = useState(day.slice(0, 7))
  const [shown, setShown] = useState(day)
  if (shown !== day) {
    setShown(day)
    setMonth(day.slice(0, 7))
  }
  const first = `${month}-01`
  const count = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
  const offset = new Date(`${first}T12:00:00Z`).getUTCDay()
  const today = localDay()
  return (
    <section className={card} aria-label="Calendar">
      <div className="mb-2 flex items-center justify-between">
        <button
          aria-label="Previous month"
          className="h-9 w-9 rounded-full hover:bg-[var(--ink-border)]/40 disabled:opacity-30"
          disabled={month <= DAILY_EPOCH.slice(0, 7)}
          onClick={() => setMonth(shiftDay(first, -1).slice(0, 7))}
        >
          ‹
        </button>
        <h2 className="font-semibold">
          {new Date(`${first}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </h2>
        <button
          aria-label="Next month"
          className="h-9 w-9 rounded-full hover:bg-[var(--ink-border)]/40 disabled:opacity-30"
          disabled={month >= today.slice(0, 7)}
          onClick={() => setMonth(shiftDay(`${month}-${count}`, 1).slice(0, 7))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className={`py-1 text-xs ${muted}`}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, '0')}`
          const dayRows = rows.filter((r) => r.day === d)
          const played = dayRows.some((r) => r.name === me)
          const won = GAME_IDS.some((g) => winners(dayRows.filter((r) => r.game === g)).includes(me))
          const mark = won ? '★' : played ? '✓' : dayRows.length ? '·' : ''
          const what = won ? 'you won' : played ? 'you played' : dayRows.length ? 'others played' : 'no scores'
          return (
            <button
              key={d}
              title={`${d}: ${what}`}
              aria-label={`${d}, ${what}`}
              aria-pressed={day === d}
              disabled={d < DAILY_EPOCH || d > today}
              onClick={() => onPick(d)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg leading-none disabled:opacity-30 ${
                day === d ? 'bg-[var(--ink-accent)] text-white' : d === today ? 'ring-1 ring-[var(--ink-accent)]' : 'hover:bg-[var(--ink-border)]/40'
              }`}
            >
              {i + 1}
              <span className="mt-0.5 h-3 text-[10px]">{mark}</span>
            </button>
          )
        })}
      </div>
      <p className={`mt-2 text-xs ${muted}`}>★ you won · ✓ you played · · others played</p>
    </section>
  )
}

/**
 * Renders the leaderboard page.
 */
export function ScoresHub() {
  const params = useSearchParams()
  const router = useRouter()
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(getPlayer()), () => 'null')
  const player = useMemo(() => JSON.parse(raw) as Player | null, [raw])
  const me = player?.name ?? ''
  const [editing, setEditing] = useState(false)
  const asked = params.get('d')
  const day = asked && validDay(asked) && asked >= DAILY_EPOCH ? asked : localDay()
  const [tab, setTab] = useState<Tab>('all')
  const [span, setSpan] = useState<30 | 0>(30)
  const [response, setResponse] = useState<{ group: string; rows: BoardRow[]; legacyRows: BoardRow[] } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const group = player?.group ?? PUBLIC_GROUP

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const load = async () => {
      try {
        await flushResults()
        const r = await fetch(`/api/results?group=${encodeURIComponent(group)}&days=4000`, { signal: controller.signal })
        if (!r.ok) throw new Error('Could not load scores. Saved scores retry on their own.')
        const data = (await r.json()) as { rows: BoardRow[]; legacyRows?: BoardRow[] }
        if (cancelled) return
        setResponse({ group, rows: data.rows.filter((x) => GAME_IDS.includes(x.game)), legacyRows: data.legacyRows ?? [] })
        setError('')
      } catch (e) {
        if (!cancelled && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load scores')
      }
    }
    void load()
    const reload = () => void load()
    const timer = setInterval(reload, 15000)
    window.addEventListener('focus', reload)
    window.addEventListener(RESULTS_CHANGED, reload)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', reload)
      window.removeEventListener(RESULTS_CHANGED, reload)
    }
  }, [group])

  const rows = response?.group === group ? response.rows : []
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
    const dayWins = new Map<string, number>()
    if (tab === 'all') {
      for (const d of new Set(windowRows.map((r) => r.day))) {
        const o = overallDay(windowRows.filter((r) => r.day === d))
        if (o.names.length === 1) dayWins.set(o.names[0]!, (dayWins.get(o.names[0]!) ?? 0) + 1)
      }
    }
    return [...new Set(windowRows.map((r) => r.name))]
      .map((name) => {
        const own = windowRows.filter((r) => r.name === name)
        const scores = own.map((r) => r.score)
        return {
          name,
          played: tab === 'all' ? new Set(own.map((r) => r.day)).size : own.length,
          avg: tab === 'all' ? null : average(scores),
          best: tab === 'all' ? null : bestGameScore(tab, scores),
          time: (() => { const t = own.flatMap((r) => (r.stats.seconds === undefined ? [] : [r.stats.seconds])); return t.length ? Math.round(average(t)) : null })(),
          wins: wins.get(name) ?? 0,
          dayWins: dayWins.get(name) ?? 0,
        }
      })
      .sort((a, b) => b.dayWins - a.dayWins || b.wins - a.wins || b.played - a.played || a.name.localeCompare(b.name))
  })()

  const timed = tab === 'connections' || tab === 'fivefold'
  const mine = shown.filter((r) => r.name === me && r.day <= day)
  const mineToday = rows.filter((r) => r.name === me && r.day === day)
  const streak = streaks(mine, day)
  const overall = overallDay(rows.filter((r) => r.day === day))
  const dayLabel = day === localDay() ? 'Today' : new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="mx-auto max-w-4xl space-y-3" data-testid="scores-hub">
      <header className="flex items-center gap-2">
        <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
        <h1 className="mr-auto font-lora text-2xl font-bold sm:text-3xl">Daily leaderboard</h1>
        <Info>
          <ul className="list-disc space-y-1 pl-4">
            {GAME_IDS.map((g) => (
              <li key={g}>
                <strong>{GAMES[g].title}:</strong> {GAMES[g].rules}
              </li>
            ))}
          </ul>
          <p className={muted}>
            A day&apos;s win needs at least 2 players; ties share it. The overall winner of a day won the most games.
            Days follow Pacific time.
          </p>
        </Info>
      </header>

      {editing ? (
        <PlayerForm key={raw} player={player} onDone={() => setEditing(false)} />
      ) : (
        <div className={`flex flex-wrap items-center gap-2 text-sm ${muted}`}>
          <PlayerName />
          <span>{boardName(player?.group ?? PUBLIC_GROUP)}</span>
          <button aria-label="Edit leaderboard group" title="Edit leaderboard group" className="inline-flex h-8 w-8 items-center justify-center" onClick={() => setEditing(true)}><PencilIcon /></button>
        </div>
      )}

      <nav aria-label="Game" className="flex flex-wrap gap-1.5">
        {(['all', ...GAME_IDS] as Tab[]).map((g) => (
          <button
            key={g}
            aria-pressed={tab === g}
            onClick={() => setTab(g)}
            className={`${pill} ${tab === g ? 'border-[var(--ink-text)] bg-[var(--ink-text)] text-[var(--ink-bg)]' : 'border-[var(--ink-border)]'}`}
          >
            {g === 'all' ? 'All games' : GAMES[g].title}
          </button>
        ))}
      </nav>

      {error && (
        <p role="alert" className="rounded-lg border border-red-300 p-3 text-sm">
          {error}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Calendar rows={shown} me={me} day={day} onPick={pick} />

        <section className={`${card} space-y-2`} aria-label="Day results">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-lora text-lg font-semibold">{dayLabel}</h2>
            {tab === 'all' && overall.names.length > 0 && (
              <span className="text-sm" title="Most game wins that day">
                🏆 {overall.names.join(' & ')}
              </span>
            )}
          </div>
          {!response && !error && <p className={`text-sm ${muted}`}>Loading…</p>}
          {tab === 'all'
            ? GAME_IDS.map((g) => {
                const gr = picked.filter((r) => r.game === g)
                const top = winners(gr)
                const own = gr.find((r) => r.name === me)
                return (
                  <Link
                    key={g}
                    href={`${GAMES[g].url}?d=${day}`}
                    title={`Play ${GAMES[g].title} for this day`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--ink-border)]/30"
                  >
                    <span className="font-medium">{GAMES[g].title}</span>
                    <span className="text-right">
                      {top.length ? `🏆 ${top.join(' & ')} · ${formatGameScore(g, bestGameScore(g, gr.map((r) => r.score)))}` : ''}
                      {own ? (
                        <span className={`block text-xs ${muted}`}>You: {resultLabel(own)}</span>
                      ) : (
                        <span className={`block text-xs ${muted}`}>{gr.length ? `${gr.length} played` : 'Play →'}</span>
                      )}
                    </span>
                  </Link>
                )
              })
            : (() => {
                const ranked = [...picked].sort(compareResults)
                return ranked.length ? (
                  <ol className="space-y-1">
                    {ranked.map((r, i) => (
                      <li
                        key={r.name}
                        className={`flex justify-between rounded-lg px-2 py-1.5 text-sm ${r.name === me ? 'bg-[var(--ink-border)]/40 font-semibold' : ''}`}
                      >
                        <span>
                          <span className={`mr-2 inline-block w-5 tabular-nums ${muted}`}>{i + 1}</span>
                          {r.name}
                        </span>
                        <span className="tabular-nums">{resultLabel(r)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={`text-sm ${muted}`}>
                    No scores this day.{' '}
                    <Link className="underline" href={`${GAMES[tab].url}?d=${day}`}>
                      Play {GAMES[tab].title}
                    </Link>
                  </p>
                )
              })()}
          {mineToday.length > 0 && (
            <button
              className="text-sm underline"
              onClick={() =>
                void navigator.clipboard
                  .writeText([`sfjc.dev · ${day}`, ...mineToday.map((r) => `${GAMES[r.game].title}: ${resultLabel(r)}`)].join('\n'))
                  .then(() => setCopied(true))
              }
            >
              {copied ? 'Copied' : 'Copy my results'}
            </button>
          )}
        </section>
      </div>

      <section className={`${card} space-y-2`} aria-label="Standings" data-testid={tab === 'all' ? 'standings' : `board-${tab}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-lora text-lg font-semibold">Standings</h2>
          <div className="flex gap-1 text-sm">
            {([30, 0] as const).map((s) => (
              <button
                key={s}
                aria-pressed={span === s}
                onClick={() => setSpan(s)}
                className={`${pill} py-1 ${span === s ? 'border-[var(--ink-text)]' : 'border-transparent'}`}
              >
                {s ? '30 days' : 'All time'}
              </button>
            ))}
          </div>
        </div>
        {table.length ? (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={muted}>
                <tr>
                  <th className="px-1 py-1 font-normal">Player</th>
                  <th className="px-1 text-right font-normal" title={tab === 'all' ? 'Days with any score' : 'Days played'}>
                    Played
                  </th>
                  {tab === 'all' ? (
                    <th className="px-1 text-right font-normal" title="Days with the most game wins">
                      Day wins
                    </th>
                  ) : (
                    <>
                      <th className="px-1 text-right font-normal">Avg</th>
                      <th className="px-1 text-right font-normal">{GAMES[tab].lowerIsBetter ? 'Fastest' : 'Best'}</th>
                      {timed && <th className="px-1 text-right font-normal" title="Average solve time">Time</th>}
                    </>
                  )}
                  <th className="px-1 text-right font-normal" title="Game-days won, ties included">
                    Wins
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.map((p) => (
                  <tr key={p.name} className={`border-t border-[var(--ink-border)] ${p.name === me ? 'font-semibold' : ''}`}>
                    <td className="px-1 py-1.5">{p.name}</td>
                    <td className="px-1 text-right tabular-nums">{p.played}</td>
                    {tab === 'all' ? (
                      <td className="px-1 text-right tabular-nums">{p.dayWins}</td>
                    ) : (
                      <>
                        <td className="px-1 text-right tabular-nums">{formatGameScore(tab, p.avg ?? 0)}</td>
                        <td className="px-1 text-right tabular-nums">{formatGameScore(tab, p.best ?? 0)}</td>
                        {timed && <td className="px-1 text-right tabular-nums">{p.time === null ? '-' : formatTime(p.time)}</td>}
                      </>
                    )}
                    <td className="px-1 text-right tabular-nums">{p.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={`text-sm ${muted}`}>No scores in this period yet.</p>
        )}
      </section>

      {mine.length > 0 && (
        <details className={card}>
          <summary className="cursor-pointer font-lora text-lg font-semibold">Your stats</summary>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ['Days played', new Set(mine.map((r) => r.day)).size],
                ['Streak', streak.current],
                ['Longest', streak.longest],
              ] as const
            ).map(([l, v]) => (
              <div key={l}>
                <p className="text-xl font-semibold tabular-nums">{v}</p>
                <p className={`text-xs ${muted}`}>{l}</p>
              </div>
            ))}
          </div>
          {tab !== 'all' && <Trend rows={mine} day={day} />}
        </details>
      )}

      {!!response?.legacyRows.length && (
        <details className={`text-xs ${muted}`}>
          <summary className="cursor-pointer">Older results under earlier scoring ({response.legacyRows.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {response.legacyRows.map((r) => (
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
