'use client'

/**
 * Scores hub UI: the name + group form, a paste box that logs any official game's Share text, a row for
 * typing a score by hand, the group's boards and each player's own stats per game, the prompt shown after
 * coming back from an official game, and the slim strip shown under a framed game.
 */
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { HomeLink } from '@/components/HomeLink'
import {
  GAMES,
  GAME_IDS,
  PLAYER_CHANGED,
  PLAY_CHANGED,
  endPlay,
  formatScore,
  formatTime,
  getPlay,
  getPlayer,
  localDay,
  logResult,
  setPlayer,
  startPlay,
  type BoardRow,
  type GameId,
  type Player,
  type Result,
} from '@/lib/results'

const field =
  'w-full rounded-md border bg-[var(--ink-bg)] px-3 py-2 text-base outline-none focus:border-[var(--ink-accent)]'
const card = 'rounded-lg border p-3 sm:p-4'
const cardStyle = { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }
const border = { borderColor: 'var(--ink-border)' }
const muted = { color: 'var(--ink-muted)' }
const accent = { color: 'var(--ink-accent)' }
const solid = { backgroundColor: 'var(--ink-accent)' }

/**
 * Subscribes to changes of the saved player or the opened game, made in this tab or another one,
 * and to the page coming back into view.
 */
function subscribeStore(cb: () => void): () => void {
  const evs = [PLAYER_CHANGED, PLAY_CHANGED, 'storage', 'focus']
  evs.forEach((e) => window.addEventListener(e, cb))
  document.addEventListener('visibilitychange', cb)
  return () => {
    evs.forEach((e) => window.removeEventListener(e, cb))
    document.removeEventListener('visibilitychange', cb)
  }
}

/**
 * Returns the saved player, re-rendering when it changes. Null on the server and until one is saved.
 */
function usePlayer(): Player | null {
  const raw = useSyncExternalStore(
    subscribeStore,
    () => JSON.stringify(getPlayer()),
    () => 'null',
  )
  return useMemo(() => JSON.parse(raw) as Player | null, [raw])
}

/**
 * Returns the official game that was opened and not logged yet, or null.
 */
function useOpenGame(): GameId | null {
  return useSyncExternalStore(
    subscribeStore,
    () => getPlay()?.game ?? null,
    () => null,
  )
}

/**
 * Describes a stored result in 1 line for the status message.
 */
function summary(r: Result, kept?: boolean): string {
  const time = r.stats.secs ? ` in ${formatTime(r.stats.secs)}` : ''
  return `${GAMES[r.game].title} - ${formatScore(r.game, r.score)}${time} ${kept ? 'was already logged for that day' : 'logged'}`
}

/**
 * Logs a result as soon as Share text is pasted. Typed text needs the Log button.
 */
export function ScorePaste({ onLogged }: { onLogged?: () => void }) {
  const [val, setVal] = useState('')
  const [msg, setMsg] = useState('')

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      setMsg('Saving...')
      const r = await logResult({ text })
      if (!r.result) return setMsg(r.error ?? 'Could not save')
      setVal('')
      setMsg(summary(r.result, r.kept))
      onLogged?.()
    },
    [onLogged],
  )

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <textarea
          value={val}
          rows={2}
          placeholder="Paste a game's Share text here"
          aria-label="Paste a game result"
          className={`${field} resize-none`}
          style={border}
          onChange={(e) => setVal(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text')
            if (!t) return
            e.preventDefault()
            setVal(t)
            void send(t)
          }}
        />
        {val && (
          <button type="button" onClick={() => void send(val)} className="rounded-md px-4 font-semibold text-white" style={solid}>
            Log
          </button>
        )}
      </div>
      <p aria-live="polite" className="mt-1 min-h-5 text-sm" style={muted}>
        {msg}
      </p>
    </div>
  )
}

/**
 * Logs a score typed by hand, for games with no Share text (NYT Spelling Bee) or a lost clipboard.
 * Timed games take m:ss.
 */
function HandEntry({ onLogged }: { onLogged: () => void }) {
  const [game, setGame] = useState<GameId>('nyt-bee')
  const [val, setVal] = useState('')
  const [msg, setMsg] = useState('')
  const def = GAMES[game]
  const m = /^(\d+):(\d{2})$/.exec(val.trim())
  const score = def.time && m ? Number(m[1]) * 60 + Number(m[2]) : /^\d+$/.test(val.trim()) ? Number(val) : null

  return (
    <form
      className="space-y-1"
      onSubmit={async (e) => {
        e.preventDefault()
        if (score === null) return
        const r = await logResult({ game, score })
        setMsg(r.result ? summary(r.result, r.kept) : (r.error ?? 'Could not save'))
        if (!r.result) return
        setVal('')
        onLogged()
      }}
    >
      <div className="flex gap-2">
        <select value={game} onChange={(e) => setGame(e.target.value as GameId)} aria-label="Game" className={field} style={border}>
          {GAME_IDS.filter((g) => GAMES[g].official).map((g) => (
            <option key={g} value={g}>
              {GAMES[g].title}
            </option>
          ))}
        </select>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          inputMode={def.time ? 'text' : 'numeric'}
          placeholder={def.time ? 'm:ss' : game === 'nyt-connections' ? 'wrong guesses' : 'points'}
          aria-label="Score"
          className={`${field} max-w-32`}
          style={border}
        />
        <button type="submit" disabled={score === null} className="rounded-md px-4 font-semibold text-white disabled:opacity-40" style={solid}>
          Add
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm" style={muted}>
        {msg}
      </p>
    </form>
  )
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
      <button type="submit" disabled={!ok} className="w-full rounded-md py-2 font-semibold text-white disabled:opacity-40" style={solid}>
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
function standings(game: GameId, rows: BoardRow[], today: string): Standing[] {
  const sign = GAMES[game].lowerWins ? 1 : -1
  const weekAgo = shiftDay(today, -6)
  const wins = new Map<string, number>()
  for (const d of new Set(rows.map((r) => r.day))) {
    const day = rows.filter((r) => r.day === d)
    if (day.length < 2) continue
    const top = Math.min(...day.map((r) => sign * r.score))
    for (const r of day) if (sign * r.score === top) wins.set(r.name, (wins.get(r.name) ?? 0) + 1)
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
        Number(a.today === null) - Number(b.today === null) ||
        sign * ((a.today ?? a.week ?? 0) - (b.today ?? b.week ?? 0)),
    )
}

/**
 * Builds one player's stats for a game as label and value pairs, in plain words.
 */
function facts(game: GameId, own: BoardRow[], today: string, wins: number): [string, string][] {
  const def = GAMES[game]
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
  const best = def.lowerWins ? Math.min(...scores) : Math.max(...scores)
  const out: [string, string][] = [
    ['Days played', String(days.size)],
    ['Day streak', String(streak)],
    ['Longest streak', String(longest)],
    [def.time ? 'Fastest' : game === 'nyt-connections' ? 'Fewest wrong' : 'Best', formatScore(game, best)],
    ['Average', game === 'nyt-connections' ? `${mean(scores).toFixed(1)} wrong` : formatScore(game, mean(scores))],
    ['Days won', String(wins)],
  ]
  const secs = own.flatMap((r) => (r.stats?.secs ? [r.stats.secs] : []))
  if (secs.length) out.push(['Average time', formatTime(mean(secs))], ['Fastest time', formatTime(Math.min(...secs))])
  if (game === 'nyt-connections') {
    out.push(
      ['Solved', `${scores.filter((s) => s < 4).length} of ${scores.length}`],
      ['No mistakes', String(scores.filter((s) => s === 0).length)],
      ['Purple first', String(own.filter((r) => r.stats?.first === 'purple').length)],
    )
  }
  if (game === 'anthropeum') {
    const pcts = own.flatMap((r) => (r.stats?.pct ? [r.stats.pct] : []))
    const tops = own.flatMap((r) => (r.stats?.top === undefined ? [] : [r.stats.top]))
    if (pcts.length) out.push(['Best rank', `top ${Math.min(...pcts)}%`])
    if (tops.length) out.push(['Rounds 9,000+', `${mean(tops).toFixed(1)} of 10`])
  }
  if (game === 'bee') {
    const words = own.flatMap((r) => (r.stats?.n ? [r.stats.n] : []))
    if (words.length) out.push(['Most words', String(Math.max(...words))])
  }
  return out
}

/**
 * Asks for the result of the official game that was just opened, on the page the player comes back to.
 */
export function PlayPrompt({ onLogged }: { onLogged?: () => void }) {
  const player = usePlayer()
  const game = useOpenGame()
  if (!game) return null
  return (
    <div className={`${card} mb-4`} style={cardStyle}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold">Finished {GAMES[game].title}? Tap Share there, then paste here.</p>
        <button type="button" onClick={endPlay} className="text-sm underline" style={muted}>
          Skip
        </button>
      </div>
      {player ? (
        <ScorePaste {...(onLogged ? { onLogged } : {})} />
      ) : (
        <Link href="/leaderboards" className="underline" style={accent}>
          Set your name and group on Scores first
        </Link>
      )}
    </div>
  )
}

/**
 * Renders the Scores hub: player setup, links to the games, result entry, the group's boards and own stats.
 */
export function ScoresHub() {
  const player = usePlayer()
  const [editing, setEditing] = useState(false)
  const [byHand, setByHand] = useState(false)
  const [copied, setCopied] = useState('')
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const openGame = useOpenGame()
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
    ...GAME_IDS.flatMap((g) => {
      const r = mineToday.find((x) => x.game === g)
      return r ? [`${GAMES[g].title}: ${formatScore(g, r.score)}${r.stats?.secs ? ` in ${formatTime(r.stats.secs)}` : ''}`] : []
    }),
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
        {GAME_IDS.map((g) => {
          const ext = GAMES[g].url.startsWith('http')
          return (
            <a
              key={g}
              href={GAMES[g].url}
              {...(ext ? { target: '_blank', rel: 'noopener noreferrer', onClick: () => startPlay(g) } : {})}
              className="rounded-full border px-3 py-1 text-sm"
              style={{ ...border, ...accent, backgroundColor: 'var(--ink-paper)' }}
            >
              {GAMES[g].title}
              {ext ? ' ↗' : ''}
            </a>
          )
        })}
      </div>

      {player && !editing && (
        <>
          <div>
            {openGame ? <PlayPrompt onLogged={load} /> : <ScorePaste onLogged={load} />}
            {byHand ? (
              <HandEntry onLogged={load} />
            ) : (
              <button type="button" className="text-sm underline" style={accent} onClick={() => setByHand(true)}>
                Type a score instead
              </button>
            )}
          </div>

          {mineToday.length > 0 && (
            <button
              type="button"
              className="w-full rounded-md border py-2 font-semibold"
              style={{ ...border, ...accent, backgroundColor: 'var(--ink-paper)' }}
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
            <p style={muted}>
              No results yet. Finish a game, tap its Share button, then paste here. Spelling Bee and 24 on this site log
              themselves.
            </p>
          )}

          {played.map((g) => {
            const gameRows = (rows ?? []).filter((r) => r.game === g)
            const table = standings(g, gameRows, today)
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
                        <td className="text-right tabular-nums">{s.today === null ? '-' : formatScore(g, s.today)}</td>
                        <td className="text-right tabular-nums">{s.week === null ? '-' : formatScore(g, s.week)}</td>
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
                      {facts(g, own, today, table.find((s) => s.name === player.name)?.wins ?? 0).map(([l, v]) => (
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

/**
 * Slim strip under a framed game: home, a paste box that slides up to log the score, the Scores link and
 * a credit link to the official site. Opening the page starts the game's play timer.
 */
export function ScoreStrip({ game, source }: { game: GameId; source: string }) {
  const player = usePlayer()
  const [open, setOpen] = useState(false)
  const link = 'px-2 py-1 text-sm underline-offset-2 hover:underline'

  useEffect(() => startPlay(game), [game])

  return (
    <div className="pb-safe relative flex-none border-t" style={cardStyle}>
      {open && (
        <div className="absolute inset-x-0 bottom-full border-t p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]" style={cardStyle}>
          {player ? (
            <ScorePaste />
          ) : (
            <Link href="/leaderboards" className="underline" style={accent}>
              Set your name and group on Scores first
            </Link>
          )}
        </div>
      )}
      <div className="flex h-9 items-center justify-between px-2">
        <HomeLink />
        <button type="button" className={link} style={accent} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Log score'}
        </button>
        <Link href="/leaderboards" className={link} style={accent}>
          Scores
        </Link>
        <a href={source} target="_blank" rel="noopener noreferrer" className={link} style={muted}>
          {new URL(source).host} ↗
        </a>
      </div>
    </div>
  )
}
