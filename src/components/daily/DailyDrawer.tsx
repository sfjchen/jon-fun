'use client'

/*
 * Home header Daily button and drawer: today's progress, streak and links to the 6 daily games.
 * Done state merges the synced board rows with the unsynced local queue for the saved player.
 */
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import PlayerName from '@/components/PlayerName'
import {
  GAMES, PLAYER_CHANGED, PUBLIC_GROUP, RESULTS_CHANGED, formatGameScore, getPlayer, localDay, queue,
  type BoardRow, type GameId,
} from '@/lib/results'
import { streaks } from '@/lib/score-stats'

const ORDER: GameId[] = ['set', 'bee', 'connections', 'mini', 'krillion', 'anthropeum']
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
 * Loads the player's recent results, cached per group so remounts show the last rows at once, plus the local unsynced queue.
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
    return () => events.forEach((e) => window.removeEventListener(e, bump))
  }, [])
  useEffect(() => {
    if (!player) return
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
  }, [group, player, tick])
  const day = localDay()
  const rows: BoardRow[] = []
  if (player) {
    const mine = remote.filter((r) => r.name === player.name)
    const local = queue().filter((q) => (!q.player || q.player.name === player.name) && q.day <= day)
    rows.push(...mine)
    local.forEach((q) => {
      if (!mine.some((r) => r.game === q.game && r.day === q.day)) rows.push({ ...q, name: player.name })
    })
  }
  const today = new Map(rows.filter((r) => r.day === day).map((r) => [r.game, r]))
  return { player, today, streak: streaks(rows, day).current }
}

/**
 * Renders the header Daily button, leaderboard link and the drawer they open.
 */
export function DailyHeader() {
  const { player, today, streak } = useDaily()
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
  const label = player ? `Daily ${today.size}/${ORDER.length}${streak ? ` · 🔥${streak}` : ''}` : 'Daily'
  return (
    <div data-game-theme="daily" className="flex items-center gap-1.5 bg-transparent">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="rounded-full bg-[var(--ink-text)] px-3.5 py-1.5 text-sm font-semibold text-white hover:opacity-90"
      >
        {label}
      </button>
      <Link
        href="/leaderboards"
        aria-label="Daily leaderboard"
        title="Daily leaderboard"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink-text)] text-white hover:opacity-90"
      >
        <svg aria-hidden viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M5 20v-7M12 20V4M19 20v-11" />
        </svg>
      </Link>
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
                {today.size}/{ORDER.length} today · {streak ? `🔥 ${streak} day streak` : 'No streak yet'} · <PlayerName />
              </p>
            ) : (
              <p className="mb-4 flex flex-wrap items-center gap-1 rounded-xl bg-[var(--ink-paper)] p-3 text-sm">
                Set your name to track scores and streaks: <PlayerName />
              </p>
            )}
            <ul className="space-y-2">
              {ORDER.map((g) => {
                const r = today.get(g)
                return (
                  <li key={g}>
                    <Link
                      href={GAMES[g].url}
                      onClick={close}
                      className="flex items-center gap-3 rounded-xl border border-[var(--ink-border)] p-3 hover:bg-[var(--ink-paper)]"
                    >
                      <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: `var(--g-${g})` }} />
                      <span className="flex-1 font-semibold">{GAMES[g].title}</span>
                      {r ? (
                        <span className="text-right text-sm">
                          <span className="font-semibold text-[var(--ink-text)]">{g === 'bee' ? '✓ played' : '✓ done'}</span>
                          <span className="block text-xs text-[var(--ink-muted)]">{formatGameScore(g, r.score)}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--ink-muted)]">Play →</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Link
              href="/leaderboards"
              onClick={close}
              className="mt-4 block rounded-xl bg-[var(--ink-text)] py-2.5 text-center text-sm font-semibold text-white hover:opacity-90"
            >
              Daily leaderboard
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
