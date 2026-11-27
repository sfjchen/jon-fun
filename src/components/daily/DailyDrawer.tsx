'use client'

/*
 * Home header Daily and Beta buttons and the drawer they open. Daily holds the 6 original games and Beta the games
 * still being built, each with its own count, streak and played grid, and the drawer's 2 tabs switch between them.
 * The drawer shows today's progress, the streak, and a day picker beside the tabs that shows any
 * day's links to the shelf's games and who has played them that day, as not done, started or completed marks with
 * no scores (Spelling Bee shows its words found). Done state merges the synced board rows with the unsynced local
 * queue for the saved player.
 */
import Image from 'next/image'
import Link from 'next/link'
import { ViewTransition, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import DayPicker from '@/components/daily/DayPicker'
import { titleTransition } from '@/components/daily/DayNav'
import PlayerName from '@/components/PlayerName'
import ScoreTable, { Mark, playState, type PlayState } from '@/components/daily/ScoreTable'
import { disableNudges, enableNudges, nudge, useNudgeState, usePushStatus } from '@/lib/push'
import { FIRST_DAY, firstDay, isNytGame, shiftDay, siteDay } from '@/lib/daily'
import { useSiteDay } from '@/lib/play-day'
import { usePlayer } from '@/lib/use-player'
import { useBoard } from '@/lib/use-board'
import {
  GAMES,
  SHELVES,
  shelfOfPath,
  PUBLIC_GROUP,
  PLAYING_KEY,
  RESULT_QUEUED,
  queue,
  getPlayer,
  isPracticeResult,
  GUEST,
  type BoardRow,
  type GameId,
  type Shelf,
} from '@/lib/results'
import { streaks } from '@/lib/score-stats'

/**
 * Loads the group's last 60 days once for the button's count and streak, and polls the selected day only while the
 * drawer is open, then merges the player's unsynced local queue. Returns, for the open shelf's games, the player's
 * done state on the selected day, everyone's results that day and the friends to nudge, plus each shelf's count
 * today and streak for the buttons.
 */
function useDaily(sel: string, open: boolean, ids: GameId[]) {
  const player = usePlayer()
  const group = player?.group ?? PUBLIC_GROUP
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener(RESULT_QUEUED, bump)
    return () => window.removeEventListener(RESULT_QUEUED, bump)
  }, [])
  const day = siteDay()
  const board = useBoard(group, 60, sel, open)
  const all = [...board.rows]
  if (player) {
    const local = queue().filter((q) => (!q.player || q.player.name === player.name) && q.day <= day && GAMES[q.game])
    local.forEach((q) => {
      if (!all.some((r) => r.name === player.name && r.game === q.game && r.day === q.day))
        all.push({ ...q, name: player.name })
    })
  }
  const rows = all.filter((r) => ids.includes(r.game))
  const shared = ids.includes('crossword')
  // The crossword has no result until it is solved, so its live word counts come from the board's shared grid.
  const [grid, setGrid] = useState<{ key: string; players: { name: string; words: number }[] }>()
  const gridKey = `${group}:${sel}`
  useEffect(() => {
    if (!open || !shared) return
    let live = true
    void fetch(`/api/puzzle-rooms?group=${group}&day=${sel}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => live && data && setGrid({ key: `${group}:${sel}`, players: data.players }))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [open, shared, group, sel])
  const filling: BoardRow[] = (shared && grid?.key === gridKey ? grid.players : [])
    .filter((p) => p.name !== GUEST && !rows.some((r) => r.name === p.name && r.game === 'crossword' && r.day === sel))
    .map((p) => ({ name: p.name, game: 'crossword', day: sel, score: 0, stats: { n: p.words } }))
  const mine = player ? rows.filter((r) => r.name === player.name) : []
  const done = (d: string) => new Map(mine.filter((r) => r.day === d).map((r) => [r.game, r]))
  return {
    player,
    /** Counts the games of a shelf the player has finished today. */
    today: (s: Shelf) =>
      all.filter((r) => r.name === player?.name && r.day === day && SHELVES[s].ids.includes(r.game)).length,
    picked: done(sel),
    everyone: [...rows.filter((r) => r.day === sel), ...filling],
    /** Returns the player's run of days with a finished game on a shelf. */
    streakOf: (s: Shelf) =>
      streaks(
        all.filter((r) => r.name === player?.name && SHELVES[s].ids.includes(r.game)),
        day,
      ).current,
    loaded: board.loaded,
    // Up to 8 friends who played most in the last week and have games left today, with how many they finished.
    friends: [...new Set(rows.filter((r) => r.day >= shiftDay(day, -7) && r.name !== player?.name).map((r) => r.name))]
      .map((n) => ({
        name: n,
        done: rows.filter((r) => r.name === n && r.day === day).length,
        days: new Set(rows.filter((r) => r.name === n && r.day >= shiftDay(day, -7)).map((r) => r.day)).size,
      }))
      .filter((f) => f.done < ids.length)
      .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name))
      .slice(0, 8),
  }
}

/** Marks that the drawer already opened by itself this session. */
const OPENED = 'sfjc_daily_auto_opened'

/**
 * Draws a ring of 1 slice per game on a shelf, filling a slice for each game finished today, like an activity ring.
 */
function Ring({ done, of, size }: { done: number; of: number; size: number }) {
  const r = 6.5,
    c = 2 * Math.PI * r,
    seg = c / of
  return (
    <svg aria-hidden viewBox="0 0 16 16" width={size} height={size} className="-rotate-90">
      {Array.from({ length: of }, (_, i) => (
        <circle
          key={i}
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${seg - 1.2} ${c - seg + 1.2}`}
          strokeDashoffset={-i * seg}
          opacity={i < done ? 1 : 0.28}
        />
      ))}
    </svg>
  )
}

/**
 * Renders the header Daily and Beta buttons, leaderboard link and the drawer they open. Game headers pass `compact`
 * for 1 smaller button, for the shelf their game sits on, without the leaderboard link, since they show their own.
 * The other shelf is 1 tap away on the drawer's tabs. A page with no game of its own passes its `shelf`.
 */
export function DailyHeader({ compact = false, shelf: pageShelf }: { compact?: boolean; shelf?: Shelf }) {
  /** Read only in the browser, so a server on another day (or a test clock) never mismatches the page. */
  const now = useSiteDay()
  const [picked, setPicked] = useState('')
  const sel = picked || now || siteDay()
  const [open, setOpen] = useState(false)
  const path = usePathname()
  const home = pageShelf ?? shelfOfPath(path)
  // The shelf the drawer shows, which starts as the page's own until a button or tab picks one.
  const [chosen, setChosen] = useState<Shelf>()
  const shelf = chosen ?? home
  const { title, ids } = SHELVES[shelf]
  const { player, today, picked: done, everyone, streakOf, loaded, friends } = useDaily(sel, open, ids)
  const todayCount = today(shelf),
    streak = streakOf(shelf)
  const push = usePushStatus(player)
  const nudges = useNudgeState(player, open)
  const [nudged, setNudged] = useState<Record<string, string>>({})
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  // Phone sheets follow a downward drag on the handle or header and close past 90px or on a quick flick.
  const [drag, setDrag] = useState(0)
  const close = useCallback(() => {
    setOpen(false)
    setDrag(0)
    btn.current?.focus()
  }, [])
  const grab = useRef<{ y: number; t: number; on: boolean } | null>(null)
  const sheet = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse' && window.innerWidth < 640)
        grab.current = { y: e.clientY, t: e.timeStamp, on: false }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = grab.current
      if (!g) return
      const dy = e.clientY - g.y
      if (!g.on && dy > 6) {
        g.on = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      if (g.on) setDrag(Math.max(0, dy))
    },
    onPointerUp: (e: React.PointerEvent) => {
      const g = grab.current
      grab.current = null
      if (!g?.on) return
      const dy = e.clientY - g.y
      if (dy > 90 || dy / (e.timeStamp - g.t) > 0.6) close()
      else setDrag(0)
    },
    onPointerCancel: () => {
      grab.current = null
      setDrag(0)
    },
  }
  useEffect(() => {
    if (!open) return
    const first = panel.current?.querySelector<HTMLElement>('a,button,input')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close()
      // Up and down walk the list of games, so Enter opens the one in focus.
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const rows = [...(panel.current?.querySelectorAll<HTMLElement>('ul a') ?? [])]
        const at = rows.indexOf(document.activeElement as HTMLElement),
          step = e.key === 'ArrowDown' ? 1 : -1
        if (!rows.length || (document.activeElement as HTMLElement | null)?.tagName === 'INPUT') return
        e.preventDefault()
        return rows[at < 0 ? (step > 0 ? 0 : rows.length - 1) : (at + step + rows.length) % rows.length]?.focus()
      }
      if (e.key !== 'Tab') return
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input') ?? [])]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        items[0]?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])
  // The drawer opens by itself on a player's first home page visit each session, and whenever a nudge notification
  // opens the site with ?daily=1 (the param is dropped). Visitors with no saved name see the plain home page.
  useEffect(() => {
    if (compact) return
    const u = new URL(window.location.href),
      nudged = u.searchParams.get('daily') === '1'
    let first = false
    try {
      first = u.pathname === '/' && !!getPlayer() && !sessionStorage.getItem(OPENED)
      sessionStorage.setItem(OPENED, '1')
    } catch {
      /* Storage blocked: only the nudge link opens the drawer. */
    }
    if (nudged) {
      u.searchParams.delete('daily')
      window.history.replaceState(null, '', u)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Opens once after hydration from state the server cannot see.
    if (nudged || first) setOpen(true)
  }, [compact])
  const isToday = !now || sel === now
  // Nudges are about the Daily games, so only that shelf offers them.
  const canNudge = shelf === 'daily' && isToday && friends.length > 0
  // Today links to the bare game path, which pins the day when it opens, and other days add the ?d= day param.
  const q = isToday ? '' : `?d=${sel}`
  const dayName = isToday
    ? 'today'
    : new Date(`${sel}T12:00:00Z`).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: sel.slice(0, 4) === now.slice(0, 4) ? undefined : 'numeric',
      })
  // The streak runs through yesterday until a game is played today, so a streak with no game yet today is at risk.
  const risk = !!streak && !todayCount
  const flame = (
    <span
      className={risk ? 'opacity-45 grayscale' : ''}
      title={risk ? `Play today to keep your ${streak} day streak` : `${streak} day streak`}
    >
      🔥{streak}
    </span>
  )
  /** Names a shelf's button for screen readers: its count today and, for the open shelf's own, the streak. */
  const status = (s: Shelf) => {
    const run = streakOf(s)
    return player
      ? `${SHELVES[s].title}, ${today(s)} of ${SHELVES[s].ids.length} done today${run ? `, ${run} day streak${today(s) ? '' : ' at risk'}` : ''}`
      : SHELVES[s].title
  }
  return (
    <div data-game-theme="daily" className="flex items-center gap-1.5 bg-transparent">
      {(compact ? [home] : (['daily', 'beta'] as const)).map((s) => (
        <button
          key={s}
          ref={s === shelf || compact ? btn : undefined}
          type="button"
          aria-haspopup="dialog"
          aria-label={status(s)}
          title={s === 'beta' ? 'Beta: games still being built' : undefined}
          onClick={() => {
            setPicked('')
            setChosen(s)
            setOpen(true)
          }}
          className={
            'inline-flex items-center gap-1.5 rounded-full border border-[var(--ink-text)] font-semibold whitespace-nowrap ' +
            'hover:opacity-90 ' +
            (s === 'daily' ? 'bg-[var(--ink-text)] text-[var(--ink-bg)] ' : 'text-[var(--ink-text)] ') +
            (compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm')
          }
        >
          {SHELVES[s].title}
          {player && <Ring done={today(s)} of={SHELVES[s].ids.length} size={compact ? 14 : 16} />}
          {player && s === 'daily' && !!streakOf(s) && !compact && (s === shelf ? flame : `🔥${streakOf(s)}`)}
        </button>
      ))}
      {!compact && (
        <Link
          href="/leaderboards"
          aria-label="Daily leaderboard"
          title="Daily leaderboard"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink-text)] text-[var(--ink-bg)] hover:opacity-90"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M5 20v-7M12 20V4M19 20v-11" />
          </svg>
        </Link>
      )}
      {open && (
        <div data-game-theme="daily" className="fixed inset-0 z-50">
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Close ${title} drawer`}
            onClick={close}
            className="absolute inset-0 bg-black/40"
          />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={`${title} games`}
            style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
            className={
              'absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-[var(--ink-bg)] ' +
              'px-4 pt-2 pb-12 text-[var(--ink-text)] shadow-2xl transition-transform ' +
              'sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[27rem] sm:rounded-l-2xl sm:rounded-tr-none sm:p-5'
            }
          >
            <div {...sheet} className="-mx-4 -mt-2 touch-none px-4 pt-2 sm:hidden">
              <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--ink-border)]" />
            </div>
            <div {...sheet} className="mb-3 flex touch-none items-center gap-1 sm:mb-4 sm:touch-auto">
              <h2 className="sr-only">{title} games</h2>
              <div role="tablist" aria-label="Shelf" className="flex rounded-full bg-[var(--ink-paper)] p-0.5">
                {(['daily', 'beta'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={s === shelf}
                    onClick={() => setChosen(s)}
                    className={
                      'rounded-full px-3 py-1.5 text-base font-bold tracking-tight ' +
                      (s === shelf ? 'bg-[var(--ink-text)] text-[var(--ink-bg)]' : 'text-[var(--ink-muted)]')
                    }
                  >
                    {SHELVES[s].title}
                  </button>
                ))}
              </div>
              <DayPicker day={sel} today={now} minDay={FIRST_DAY} go={setPicked} className="ml-auto" keys />
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-1 h-10 w-10 shrink-0 rounded-full border border-[color-mix(in_srgb,var(--ink-text)_22%,transparent)] text-2xl leading-none hover:bg-[var(--ink-paper)]"
              >
                ×
              </button>
            </div>
            {player ? (
              <p className="mb-4 text-sm text-[var(--ink-muted)]">
                {todayCount}/{ids.length} today · {flame} · <PlayerName />
                {(push === 'off' || push === 'on') && (
                  <button
                    type="button"
                    className="ml-1 rounded-full px-1.5 py-0.5 hover:bg-[var(--ink-paper)]"
                    aria-pressed={push === 'on'}
                    title={
                      push === 'on' ? 'Nudges are on. Tap to turn off.' : 'Get a notification when a friend nudges you'
                    }
                    onClick={() =>
                      void (push === 'on'
                        ? disableNudges()
                        : enableNudges(player).then((err) => err && setNudged((m) => ({ ...m, '': err }))))
                    }
                  >
                    {push === 'on' ? '🔔' : '🔕 Get nudges'}
                  </button>
                )}
                {push === 'denied' && (
                  <span
                    className="ml-1"
                    title="Allow notifications for sfjc.dev in your browser settings to get nudges"
                  >
                    🔕 blocked
                  </span>
                )}
              </p>
            ) : (
              <p className="mb-4 flex flex-wrap items-center gap-1 rounded-xl bg-[var(--ink-paper)] p-3 text-sm">
                Set your name to track scores and streaks: <PlayerName />
              </p>
            )}
            {shelf === 'beta' && (
              <p className="mb-3 text-xs text-[var(--ink-muted)]">
                Still being built. These games can change and never count toward Daily.{' '}
                <Link href="/leaderboards?shelf=beta" onClick={close} className="underline">
                  Beta leaderboard
                </Link>
              </p>
            )}
            <ul className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {ids.map((g) => {
                const r = done.get(g)
                // With no result yet, a game this browser has played on the day without finishing it is started.
                let state: PlayState = playState(r)
                try {
                  const mark = JSON.parse(localStorage.getItem(PLAYING_KEY + g) ?? 'null') as {
                    day?: string
                    at?: number
                  }
                  if (!r && mark?.day === sel && mark.at) state = 'started'
                } catch {
                  /* Storage can be disabled in a private browser. */
                }
                const row =
                  'flex min-w-0 items-center gap-1.5 rounded-xl border border-[var(--ink-border)] p-2 sm:gap-2.5'
                const name = 'min-w-0 flex-1 truncate text-[13px] font-semibold sm:text-[15px]'
                const icon = (
                  <Image
                    src={`/doodles/notebook/${g}.svg`}
                    alt=""
                    width={36}
                    height={36}
                    className="h-6 w-6 shrink-0 sm:h-8 sm:w-8"
                  />
                )
                // NYT games have no puzzle before their first day or after today, and the rest none before the epoch.
                if (sel < firstDay(g) || ((isNytGame(g) || g === 'orbs') && now && sel > now)) {
                  return (
                    <li key={g} className={`${row} opacity-40`}>
                      {icon}
                      <span className={name}>{GAMES[g].title}</span>
                      <span className="text-xs text-[var(--ink-muted)]" title="No puzzle">
                        <span className="sr-only">No puzzle</span>
                        <span aria-hidden>–</span>
                      </span>
                    </li>
                  )
                }
                return (
                  <li key={g}>
                    <Link
                      href={GAMES[g].url + q}
                      onClick={close}
                      className={`${row} ${r ? 'border-transparent bg-[var(--ink-paper)] hover:brightness-95' : 'hover:bg-[var(--ink-paper)]'}`}
                    >
                      {icon}
                      {/* The open game's own header already holds this name, and a name may appear only once. */}
                      {GAMES[g].url === path ? (
                        <span className={name}>{GAMES[g].title}</span>
                      ) : (
                        <ViewTransition name={titleTransition(GAMES[g].url)}>
                          <span className={name}>{GAMES[g].title}</span>
                        </ViewTransition>
                      )}
                      {!r && isPracticeResult(g, sel) ? (
                        <span className="text-xs text-[var(--ink-muted)]">Practice</span>
                      ) : r?.game === 'bee' ? (
                        <span className="text-sm font-semibold tabular-nums" title={`${r.stats.n ?? 0} words found`}>
                          {r.stats.n ?? 0}
                          <span className="sr-only"> words</span>
                        </span>
                      ) : (
                        <Mark state={state} />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
            {nudged[''] && !canNudge && <p className="mt-3 text-xs text-[var(--ink-muted)]">{nudged['']}</p>}
            {push === 'install' && canNudge && (
              <p className="mb-3 text-xs text-[var(--ink-muted)]">
                Add sfjc.dev to your Home Screen to get nudges from friends.
              </p>
            )}
            <section aria-label={`Played ${dayName}`} className="mt-4 sm:mt-5">
              <h3 className="mb-2 text-sm font-semibold text-[var(--ink-muted)]">
                {isToday ? 'Played today' : `Played · ${dayName}`}
              </h3>
              {everyone.length ? (
                <ScoreTable rows={everyone} me={player?.name} q={q} marks games={ids} />
              ) : !loaded ? (
                <div role="status" aria-label="Loading players" className="animate-pulse space-y-1.5">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-8 rounded-md bg-[var(--ink-border)]/40" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--ink-muted)]">
                  {now && sel > now
                    ? 'Future preview · practice only, not ranked.'
                    : `Nobody has played ${isToday ? 'yet today' : 'this day'}.`}
                </p>
              )}
            </section>
            {player && canNudge && (
              <section aria-label="Nudge friends" className="mt-4">
                <h3 className="mb-2 text-sm font-semibold text-[var(--ink-muted)]">Nudge friends</h3>
                <div className="flex flex-wrap gap-1.5">
                  {friends.map((f) => {
                    const key = f.name.toLowerCase()
                    // A friend nudged earlier today stays ticked after a reload, and one with nudges off is marked.
                    const sent = nudged[f.name] ?? (nudges?.nudged.includes(key) ? 'Nudged' : undefined)
                    const off = !!nudges && !nudges.reachable.includes(key)
                    return (
                      <button
                        key={f.name}
                        type="button"
                        disabled={sent !== undefined || push === 'loading'}
                        title={
                          sent === 'Nudged'
                            ? `You nudged ${f.name} today`
                            : off
                              ? `${f.name} has not turned on nudges, so a nudge cannot reach them yet`
                              : sent || `Nudge ${f.name}: ${ids.length - f.done} games left today`
                        }
                        onClick={() => {
                          // Senders turn on their own nudges first, so the tap asks for notifications when they are off.
                          const gate =
                            push === 'off'
                              ? enableNudges(player)
                              : Promise.resolve(
                                  push === 'denied'
                                    ? 'Allow notifications for sfjc.dev in your browser settings to nudge friends.'
                                    : push === 'install'
                                      ? 'Add sfjc.dev to your Home Screen and turn on nudges to nudge friends.'
                                      : '',
                                )
                          void gate.then((block) => {
                            if (block) return setNudged((m) => ({ ...m, '': block }))
                            setNudged((m) => ({ ...m, '': '', [f.name]: 'Sending…' }))
                            void nudge(player, f.name).then((err) =>
                              setNudged((m) => ({ ...m, [f.name]: err || 'Nudged' })),
                            )
                          })
                        }}
                        className={
                          'flex items-center gap-1.5 rounded-full border border-[var(--ink-border)] px-2.5 py-1 text-xs ' +
                          `hover:bg-[var(--ink-paper)] disabled:opacity-60 ${off && !sent ? 'opacity-50' : ''}`
                        }
                      >
                        <span className="max-w-24 truncate font-medium">{f.name}</span>
                        <span className="text-[var(--ink-muted)] tabular-nums">
                          {f.done}/{ids.length}
                        </span>
                        <span aria-hidden>{sent === 'Nudged' ? '✓' : off ? '🔕' : '👋'}</span>
                      </button>
                    )
                  })}
                </div>
                {Object.values(nudged).some((v) => v && v !== 'Nudged' && v !== 'Sending…') && (
                  <p role="status" className="mt-1.5 text-xs text-[var(--ink-muted)]">
                    {Object.entries(nudged)
                      .filter(([, v]) => v && v !== 'Nudged' && v !== 'Sending…')
                      .map(([, v]) => v)
                      .join(' · ')}
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
