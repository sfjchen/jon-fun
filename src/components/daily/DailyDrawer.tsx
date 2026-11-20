'use client'

/*
 * Home header Daily button and drawer: today's progress, streak, links to the 6 daily games and everyone's
 * scores today. Done state merges the synced board rows with the unsynced local queue for the saved player.
 */
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import PlayerName from '@/components/PlayerName'
import {
  GAMES, GAME_IDS, PLAYER_CHANGED, PUBLIC_GROUP, RESULTS_CHANGED, compareResults, formatTime, getPlayer, localDay, queue,
  onLiveRefresh, resultLabel,
  type BoardRow,
} from '@/lib/results'
import { streaks } from '@/lib/score-stats'

const cache = new Map<string, { rows: BoardRow[] }>()

/**
 * Subscribes to player and result changes made in this tab or another one.
 */
function subscribe(cb: () => void) {
  const events = [PLAYER_CHANGED, RESULTS_CHANGED, 'sfjc-score-queued', 'storage']
  events.forEach((e) => window.addEventListener(e, cb))
  return () => events.forEach((e) => window.removeEventListener(e, cb))
}

/**
 * Loads the group's recent results, cached per group so remounts show the last rows at once, then merges the
 * player's unsynced local queue. Returns the player's own done state and streak plus everyone's scores today.
 */
function useDaily() {
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(getPlayer()), () => 'null')
  const player = JSON.parse(raw) as ReturnType<typeof getPlayer>
  const group = player?.group ?? PUBLIC_GROUP
  const [remote, setRemote] = useState<BoardRow[]>(() => cache.get(group)?.rows ?? [])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    const events = [RESULTS_CHANGED, 'sfjc-score-queued']
    events.forEach((e) => window.addEventListener(e, bump))
    const stopRefresh = onLiveRefresh(bump)
    return () => { stopRefresh(); events.forEach((e) => window.removeEventListener(e, bump)) }
  }, [])
  useEffect(() => {
    const ctl = new AbortController()
    fetch(`/api/results?group=${encodeURIComponent(group)}&days=60`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rows?: BoardRow[] } | null) => {
        if (!d?.rows) return
        cache.set(group, { rows: d.rows })
        setRemote(d.rows)
      })
      .catch(() => {})
    return () => ctl.abort()
  }, [group, tick])
  const day = localDay()
  const rows = remote.filter((r) => GAMES[r.game])
  if (player) {
    const local = queue().filter((q) => (!q.player || q.player.name === player.name) && q.day <= day && GAMES[q.game])
    local.forEach((q) => {
      if (!rows.some((r) => r.name === player.name && r.game === q.game && r.day === q.day)) rows.push({ ...q, name: player.name })
    })
  }
  const mine = player ? rows.filter((r) => r.name === player.name) : []
  const today = new Map(mine.filter((r) => r.day === day).map((r) => [r.game, r]))
  return { player, today, everyone: rows.filter((r) => r.day === day), streak: streaks(mine, day).current }
}

/**
 * Returns a 1-line label short enough for a grid cell: Connections shows only its solve time (or groups found)
 * and Anthropeum rounds to thousands, so every column stays a similar width.
 */
function cellLabel(r: BoardRow): string {
  if (r.game === 'connections') return r.score === 4 && r.stats.seconds !== undefined ? formatTime(r.stats.seconds) : `${r.stats.n ?? r.score}/4`
  if (r.game === 'anthropeum') return `${Math.round(r.score / 1000)}k`
  return resultLabel(r)
}

/**
 * Renders today's scores as a grid with a row per player and a column per game icon. The best result in each
 * column, ties included, is bold, and the saved player's row is shaded. Hovering a cell shows the full result.
 */
function ScoreTable({ rows, me }: { rows: BoardRow[]; me: string | undefined }) {
  const games = GAME_IDS.filter((g) => rows.some((r) => r.game === g))
  const best = new Map(games.map((g) => [g, rows.filter((r) => r.game === g).sort(compareResults)[0]]))
  const names = [...new Set(rows.map((r) => r.name))].sort((a, b) =>
    Number(b === me) - Number(a === me) ||
      rows.filter((r) => r.name === b).length - rows.filter((r) => r.name === a).length || a.localeCompare(b))
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th scope="col" className="sr-only">Player</th>
            {games.map((g) => (
              <th key={g} scope="col" className="pb-1.5 font-normal">
                <Link href={GAMES[g].url} title={GAMES[g].title} aria-label={GAMES[g].title} className="inline-block">
                  <Image src={`/doodles/notebook/${g}.svg`} alt="" width={24} height={24} className="mx-auto h-6 w-6" />
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((n) => (
            <tr key={n} className={n === me ? 'bg-[var(--ink-paper)]' : ''}>
              <th scope="row" title={n} className="rounded-l-md px-1 py-1.5 text-left text-sm font-medium">
                <span className="block max-w-[5.5rem] truncate">{n}</span>
              </th>
              {games.map((g, i) => {
                const r = rows.find((x) => x.name === n && x.game === g)
                const top = r && compareResults(r, best.get(g)!) === 0
                const edge = i === games.length - 1 ? 'rounded-r-md' : ''
                return (
                  <td
                    key={g}
                    className={`px-0.5 py-1.5 text-center leading-tight tabular-nums ${edge} ` +
                      (top ? 'font-semibold text-[var(--ink-text)]' : 'text-[var(--ink-muted)]')}
                  >
                    {r ? <span className="whitespace-nowrap" title={resultLabel(r)}>{cellLabel(r)}</span> : '–'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Renders the header Daily button, leaderboard link and the drawer they open. Game headers pass `compact` for a
 * smaller button without the leaderboard link, since they show their own.
 */
export function DailyHeader({ compact = false }: { compact?: boolean }) {
  const { player, today, everyone, streak } = useDaily()
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useCallback(() => { setOpen(false); btn.current?.focus() }, [])
  useEffect(() => {
    if (!open) return
    const first = panel.current?.querySelector<HTMLElement>('a,button,input')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close()
      if (e.key !== 'Tab') return
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('a[href],button,input') ?? [])]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); items[0]?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])
  const label = player ? `Daily ${today.size}/${GAME_IDS.length}${streak && !compact ? ` · 🔥${streak}` : ''}` : 'Daily'
  return (
    <div data-game-theme="daily" className="flex items-center gap-1.5 bg-transparent">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={
          'whitespace-nowrap rounded-full bg-[var(--ink-text)] font-semibold text-[var(--ink-bg)] hover:opacity-90 ' +
            (compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm')
        }
      >
        {label}
      </button>
      {!compact && (
        <Link
          href="/leaderboards"
          aria-label="Daily leaderboard"
          title="Daily leaderboard"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink-text)] text-[var(--ink-bg)] hover:opacity-90"
        >
          <svg aria-hidden viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 20v-7M12 20V4M19 20v-11" />
          </svg>
        </Link>
      )}
      {open && (
        <div data-game-theme="daily" className="fixed inset-0 z-50">
          <button type="button" tabIndex={-1} aria-label="Close daily drawer" onClick={close} className="absolute inset-0 bg-black/40" />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Daily games"
            className={
              'absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-[var(--ink-bg)] p-5 text-[var(--ink-text)] shadow-2xl ' +
              'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-96 sm:rounded-l-2xl sm:rounded-tr-none'
            }
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Daily</h2>
              <button type="button" onClick={close} aria-label="Close" className="h-9 w-9 rounded-full text-xl hover:bg-[var(--ink-paper)]">×</button>
            </div>
            {player ? (
              <p className="mb-4 text-sm text-[var(--ink-muted)]">
                {today.size}/{GAME_IDS.length} today · {streak ? `🔥 ${streak} day streak` : 'No streak yet'} · <PlayerName />
              </p>
            ) : (
              <p className="mb-4 flex flex-wrap items-center gap-1 rounded-xl bg-[var(--ink-paper)] p-3 text-sm">
                Set your name to track scores and streaks: <PlayerName />
              </p>
            )}
            <ul className="space-y-2">
              {GAME_IDS.map((g) => {
                const r = today.get(g)
                return (
                  <li key={g}>
                    <Link
                      href={GAMES[g].url}
                      onClick={close}
                      className="flex items-center gap-3 rounded-xl border border-[var(--ink-border)] p-2.5 hover:bg-[var(--ink-paper)]"
                    >
                      <Image src={`/doodles/notebook/${g}.svg`} alt="" width={36} height={36} className="h-9 w-9" />
                      <span className="flex-1 font-semibold">{GAMES[g].title}</span>
                      {r && (
                        <span className="text-right text-sm">
                          <span className="font-semibold">✓</span>
                          <span className="block text-xs text-[var(--ink-muted)]">{resultLabel(r)}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <section aria-label="Today's scores" className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-[var(--ink-muted)]">Today&apos;s scores</h3>
              {everyone.length ? <ScoreTable rows={everyone} me={player?.name} /> : (
                <p className="text-sm text-[var(--ink-muted)]">No scores yet today.</p>
              )}
            </section>

          </div>
        </div>
      )}
    </div>
  )
}
