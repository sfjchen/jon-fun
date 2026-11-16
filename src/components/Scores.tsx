'use client'

/**
 * Scores hub UI: the name + group form, a paste box that logs any official game's Share text, the group's
 * boards per game, and the slim strip shown under a framed game.
 */
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { HomeLink } from '@/components/HomeLink'
import {
  GAMES,
  GAME_IDS,
  PLAYER_CHANGED,
  formatScore,
  getPlayer,
  localDay,
  logResult,
  setPlayer,
  type BoardRow,
  type GameId,
  type Player,
} from '@/lib/results'

const field =
  'w-full rounded-md border bg-[var(--ink-bg)] px-3 py-2 text-base outline-none focus:border-[var(--ink-accent)]'
const card = 'rounded-lg border p-3 sm:p-4'
const cardStyle = { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }

/**
 * Subscribes to player changes made in this tab or another one.
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
 * Returns the saved player, re-rendering when it changes. Null on the server and until one is saved.
 */
function usePlayer(): Player | null {
  const raw = useSyncExternalStore(
    subscribePlayer,
    () => JSON.stringify(getPlayer()),
    () => 'null',
  )
  return useMemo(() => JSON.parse(raw) as Player | null, [raw])
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
      setMsg(
        `${GAMES[r.result.game].title} - ${formatScore(r.result.game, r.result.score)} ` +
          (r.kept ? 'was already logged for that day' : 'logged'),
      )
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
          style={{ borderColor: 'var(--ink-border)' }}
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
          <button
            type="button"
            onClick={() => void send(val)}
            className="rounded-md px-4 font-semibold text-white"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Log
          </button>
        )}
      </div>
      <p aria-live="polite" className="mt-1 min-h-5 text-sm" style={{ color: 'var(--ink-muted)' }}>
        {msg}
      </p>
    </div>
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
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className={field} style={{ borderColor: 'var(--ink-border)' }} />
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
          style={{ borderColor: 'var(--ink-border)' }}
        />
        <span style={{ color: 'var(--ink-muted)' }}>
          Friends who type the same code share one board. 3-32 letters, numbers or dashes.
        </span>
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

type Standing = { name: string; today: number | null; avg: number; days: number; wins: number }

/**
 * Ranks a game's players by today's score, then by their average, and counts days won against others.
 */
function standings(game: GameId, rows: BoardRow[], today: string): Standing[] {
  const sign = GAMES[game].lowerWins ? 1 : -1
  const mine = rows.filter((r) => r.game === game)
  const wins = new Map<string, number>()
  for (const d of new Set(mine.map((r) => r.day))) {
    const day = mine.filter((r) => r.day === d)
    if (day.length < 2) continue
    const top = Math.min(...day.map((r) => sign * r.score))
    for (const r of day) if (sign * r.score === top) wins.set(r.name, (wins.get(r.name) ?? 0) + 1)
  }
  return [...new Set(mine.map((r) => r.name))]
    .map((name) => {
      const own = mine.filter((r) => r.name === name)
      return {
        name,
        today: own.find((r) => r.day === today)?.score ?? null,
        avg: own.reduce((s, r) => s + r.score, 0) / own.length,
        days: own.length,
        wins: wins.get(name) ?? 0,
      }
    })
    .sort(
      (a, b) =>
        Number(a.today === null) - Number(b.today === null) ||
        sign * ((a.today ?? a.avg) - (b.today ?? b.avg)),
    )
}

/**
 * Renders the Scores hub: player setup, links to the official games, the paste box and the group's boards.
 */
export function ScoresHub() {
  const player = usePlayer()
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const today = localDay()
  const group = player?.group

  const load = useCallback(() => {
    if (!group) return
    fetch(`/api/results?group=${encodeURIComponent(group)}&days=7`)
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-lora text-2xl font-semibold">Scores</h1>

      {!player || editing ? (
        <PlayerForm player={player} onDone={() => setEditing(false)} />
      ) : (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {player.name} · group {player.group} ·{' '}
          <button type="button" className="underline" style={{ color: 'var(--ink-accent)' }} onClick={() => setEditing(true)}>
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
              {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="rounded-full border px-3 py-1 text-sm"
              style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-accent)', backgroundColor: 'var(--ink-paper)' }}
            >
              {GAMES[g].title}
              {ext ? ' ↗' : ''}
            </a>
          )
        })}
      </div>

      {player && !editing && (
        <>
          <ScorePaste onLogged={load} />
          {rows && played.length === 0 && (
            <p style={{ color: 'var(--ink-muted)' }}>
              No results yet. Finish a game, tap its Share button, then paste here. Spelling Bee and 24 on this site log
              themselves.
            </p>
          )}
          {played.map((g) => (
            <section key={g} className={card} style={cardStyle}>
              <h2 className="mb-2 font-lora text-lg font-semibold">{GAMES[g].title}</h2>
              <table className="w-full text-left text-sm">
                <thead style={{ color: 'var(--ink-muted)' }}>
                  <tr>
                    <th className="font-normal">Player</th>
                    <th className="text-right font-normal">Today</th>
                    <th className="text-right font-normal">7-day avg</th>
                    <th className="text-right font-normal">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {standings(g, rows ?? [], today).map((s) => (
                    <tr key={s.name} className="border-t" style={{ borderColor: 'var(--ink-border)' }}>
                      <td className="py-1.5 font-semibold">{s.name}</td>
                      <td className="text-right tabular-nums">{s.today === null ? '-' : formatScore(g, s.today)}</td>
                      <td className="text-right tabular-nums">
                        {formatScore(g, s.avg)} <span style={{ color: 'var(--ink-muted)' }}>({s.days}d)</span>
                      </td>
                      <td className="text-right tabular-nums">{s.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
    </div>
  )
}

/**
 * Slim strip under a framed game: home, a paste box that slides up to log the score, the Scores link and
 * a credit link to the official site.
 */
export function ScoreStrip({ source }: { source: string }) {
  const player = usePlayer()
  const [open, setOpen] = useState(false)
  const link = 'px-2 py-1 text-sm underline-offset-2 hover:underline'

  return (
    <div className="pb-safe relative flex-none border-t" style={cardStyle}>
      {open && (
        <div className="absolute inset-x-0 bottom-full border-t p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]" style={cardStyle}>
          {player ? (
            <ScorePaste />
          ) : (
            <Link href="/leaderboards" className="underline" style={{ color: 'var(--ink-accent)' }}>
              Set your name and group on Scores first
            </Link>
          )}
        </div>
      )}
      <div className="flex h-9 items-center justify-between px-2">
        <HomeLink />
        <button type="button" className={link} style={{ color: 'var(--ink-accent)' }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Log score'}
        </button>
        <Link href="/leaderboards" className={link} style={{ color: 'var(--ink-accent)' }}>
          Scores
        </Link>
        <a href={source} target="_blank" rel="noopener noreferrer" className={link} style={{ color: 'var(--ink-muted)' }}>
          {new URL(source).host} ↗
        </a>
      </div>
    </div>
  )
}
