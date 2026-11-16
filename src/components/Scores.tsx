'use client'

/**
 * Scores hub UI: the name + group form, the group's boards and each player's own stats per game.
 * Scores arrive on their own from Spelling Bee and 24, so nothing here is typed or pasted.
 */
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  GAMES,
  GAME_IDS,
  PLAYER_CHANGED,
  formatScore,
  getPlayer,
  localDay,
  setPlayer,
  type BoardRow,
  type Player,
} from '@/lib/results'

const field =
  'w-full rounded-md border bg-[var(--ink-bg)] px-3 py-2 text-base outline-none focus:border-[var(--ink-accent)]'
const card = 'rounded-lg border p-3 sm:p-4'
const cardStyle = { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }
const border = { borderColor: 'var(--ink-border)' }
const muted = { color: 'var(--ink-muted)' }
const accent = { color: 'var(--ink-accent)' }
const chip = { ...border, ...accent, backgroundColor: 'var(--ink-paper)' }

/**
 * Subscribes to changes of the saved player, made in this tab or another one.
 */
function subscribePlayer(cb: () => void): () => void {
  window.addEventListener(PLAYER_CHANGED, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(PLAYER_CHANGED, cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * Collects the name and group code that results are filed under.
 */
function PlayerForm({ player, onDone }: { player: Player | null; onDone: () => void }) {
  const [name, setName] = useState(player?.name ?? '')
  const [group, setGroup] = useState(player?.group ?? '')
  const code = group.trim().toLowerCase()
  const ok = name.trim().length > 0 && /^[a-z0-9-]{3,32}$/.test(code)

  return (
    <form
      className={`${card} space-y-3`}
      style={cardStyle}
      onSubmit={(e) => {
        e.preventDefault()
        if (!ok) return
        setPlayer({ name: name.trim().slice(0, 24), group: code })
        onDone()
      }}
    >
      <label className="block text-sm">
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className={field} style={border} />
      </label>
      <label className="block text-sm">
        Group code
        <input
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          maxLength={32}
          autoCapitalize="none"
          autoCorrect="off"
          className={field}
          style={border}
        />
        <span style={muted}>Friends who type the same code share one board. 3-32 letters, numbers or dashes.</span>
      </label>
      <button
        type="submit"
        disabled={!ok}
        className="w-full rounded-md py-2 font-semibold text-white disabled:opacity-40"
        style={{ backgroundColor: 'var(--ink-accent)' }}
      >
        Save
      </button>
    </form>
  )
}

/**
 * Returns the day before or after a YYYY-MM-DD day.
 */
function shiftDay(day: string, by: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + by * 86400000).toISOString().slice(0, 10)
}

/**
 * Returns the average of a list, or 0 when it is empty.
 */
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

type Standing = { name: string; today: number | null; week: number | null; wins: number }

/**
 * Ranks a game's players by today's score, then by their 7-day average, and counts days won against others.
 */
function standings(rows: BoardRow[], today: string): Standing[] {
  const weekAgo = shiftDay(today, -6)
  const wins = new Map<string, number>()
  for (const d of new Set(rows.map((r) => r.day))) {
    const day = rows.filter((r) => r.day === d)
    if (day.length < 2) continue
    const top = Math.max(...day.map((r) => r.score))
    for (const r of day) if (r.score === top) wins.set(r.name, (wins.get(r.name) ?? 0) + 1)
  }
  return [...new Set(rows.map((r) => r.name))]
    .map((name) => {
      const week = rows.filter((r) => r.name === name && r.day >= weekAgo)
      return {
        name,
        today: rows.find((r) => r.name === name && r.day === today)?.score ?? null,
        week: week.length ? mean(week.map((r) => r.score)) : null,
        wins: wins.get(name) ?? 0,
      }
    })
    .sort(
      (a, b) =>
        Number(a.today === null) - Number(b.today === null) || (b.today ?? b.week ?? 0) - (a.today ?? a.week ?? 0),
    )
}

/**
 * Builds one player's stats for a game as label and value pairs, in plain words.
 */
function facts(own: BoardRow[], today: string, wins: number): [string, string][] {
  const days = new Set(own.map((r) => r.day))
  let streak = 0
  for (let d = days.has(today) ? today : shiftDay(today, -1); days.has(d); d = shiftDay(d, -1)) streak++
  let longest = 0
  for (const d of days) {
    if (days.has(shiftDay(d, -1))) continue
    let run = 1
    for (let n = shiftDay(d, 1); days.has(n); n = shiftDay(n, 1)) run++
    longest = Math.max(longest, run)
  }
  const scores = own.map((r) => r.score)
  const words = own.flatMap((r) => (r.stats?.n ? [r.stats.n] : []))
  return [
    ['Days played', String(days.size)],
    ['Day streak', String(streak)],
    ['Longest streak', String(longest)],
    ['Best', formatScore(Math.max(...scores))],
    ['Average', formatScore(mean(scores))],
    ['Days won', String(wins)],
    ...(words.length ? [['Most words', String(Math.max(...words))] as [string, string]] : []),
  ]
}

/**
 * Renders the Scores hub: player setup, links to the games, the group's boards and own stats.
 */
export function ScoresHub() {
  const raw = useSyncExternalStore(
    subscribePlayer,
    () => JSON.stringify(getPlayer()),
    () => 'null',
  )
  const player = useMemo(() => JSON.parse(raw) as Player | null, [raw])
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState('')
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const today = localDay()
  const group = player?.group

  const load = useCallback(() => {
    if (!group) return
    fetch(`/api/results?group=${encodeURIComponent(group)}&days=90`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rows: BoardRow[] } | null) => d && setRows(d.rows))
      .catch(() => {})
  }, [group])

  useEffect(() => {
    load()
    const onShow = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [load])

  const played = GAME_IDS.filter((g) => rows?.some((r) => r.game === g))
  const mineToday = (rows ?? []).filter((r) => r.name === player?.name && r.day === today)
  const shareText = [
    `sfjc.dev scores - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    ...mineToday.map((r) => `${GAMES[r.game].title}: ${formatScore(r.score)}`),
  ].join('\n')

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-lora text-2xl font-semibold">Scores</h1>

      {!player || editing ? (
        <PlayerForm player={player} onDone={() => setEditing(false)} />
      ) : (
        <p className="text-sm" style={muted}>
          {player.name} · group {player.group} ·{' '}
          <button type="button" className="underline" style={accent} onClick={() => setEditing(true)}>
            change
          </button>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {GAME_IDS.map((g) => (
          <Link key={g} href={GAMES[g].url} className="rounded-full border px-3 py-1 text-sm" style={chip}>
            {GAMES[g].title}
          </Link>
        ))}
      </div>

      {player && !editing && (
        <>
          {mineToday.length > 0 && (
            <button
              type="button"
              className="w-full rounded-md border py-2 font-semibold"
              style={chip}
              onClick={() =>
                navigator.clipboard.writeText(shareText).then(
                  () => setCopied('Copied'),
                  () => setCopied('Copy failed'),
                )
              }
            >
              {copied || "Copy today's results to share"}
            </button>
          )}

          {rows && played.length === 0 && (
            <p style={muted}>No results yet. Play Spelling Bee or a 24 room and your score shows up here by itself.</p>
          )}

          {played.map((g) => {
            const gameRows = (rows ?? []).filter((r) => r.game === g)
            const table = standings(gameRows, today)
            const own = gameRows.filter((r) => r.name === player.name)
            return (
              <section key={g} className={card} style={cardStyle}>
                <h2 className="mb-2 font-lora text-lg font-semibold">{GAMES[g].title}</h2>
                <table className="w-full text-left text-sm">
                  <thead style={muted}>
                    <tr>
                      <th className="font-normal">Player</th>
                      <th className="text-right font-normal">Today</th>
                      <th className="text-right font-normal">7-day average</th>
                      <th className="text-right font-normal">Days won</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((s) => (
                      <tr key={s.name} className="border-t" style={border}>
                        <td className="py-1.5 font-semibold">{s.name}</td>
                        <td className="text-right tabular-nums">{s.today === null ? '-' : formatScore(s.today)}</td>
                        <td className="text-right tabular-nums">{s.week === null ? '-' : formatScore(s.week)}</td>
                        <td className="text-right tabular-nums">{s.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {own.length > 0 && (
                  <details className="mt-3 border-t pt-2" style={border}>
                    <summary className="cursor-pointer text-sm" style={accent}>
                      Your stats, last 90 days
                    </summary>
                    <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-3 text-center">
                      {facts(own, today, table.find((s) => s.name === player.name)?.wins ?? 0).map(([l, v]) => (
                        <div key={l}>
                          <p className="text-lg font-bold tabular-nums">{v}</p>
                          <p className="text-xs" style={muted}>
                            {l}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
