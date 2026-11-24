'use client'

/*
 * Home header Daily button and drawer: today's progress, streak, and a day picker beside the title that shows any day's links to the
 * 6 daily games and everyone's scores that day. Done state merges the synced board rows with the unsynced local queue
 * for the saved player.
 */
import Image from 'next/image'
import Link from 'next/link'
import { ViewTransition, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import DayPicker from '@/components/daily/DayPicker'
import { titleTransition } from '@/components/daily/DayNav'
import PlayerName from '@/components/PlayerName'
import ScoreTable from '@/components/daily/ScoreTable'
import { disableNudges, enableNudges, nudge, useNudgeState, usePushStatus } from '@/lib/push'
import { FIRST_DAY, firstDay, isNytGame, shiftDay, siteDay } from '@/lib/daily'
import { useSiteDay } from '@/lib/play-day'
import { usePlayer } from '@/lib/use-player'
import { useBoard } from '@/lib/use-board'
import {
  GAMES,
  GAME_IDS,
  PUBLIC_GROUP,
  RESULT_QUEUED,
  queue,
  getPlayer,
  isPracticeResult,
  resultLabel,
} from '@/lib/results'
import { streaks } from '@/lib/score-stats'

/**
 * Loads the group's last 60 days once for the button's count and streak, and polls the selected day only while the
 * drawer is open, then merges the player's unsynced local queue. Returns the player's done state today and on the
 * selected day, the streak, and everyone's scores on the selected day.
 */
function useDaily(sel: string, open: boolean) {
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
  const rows = [...board.rows]
  if (player) {
    const local = queue().filter((q) => (!q.player || q.player.name === player.name) && q.day <= day && GAMES[q.game])
    local.forEach((q) => {
      if (!rows.some((r) => r.name === player.name && r.game === q.game && r.day === q.day))
        rows.push({ ...q, name: player.name })
    })
  }
  const mine = player ? rows.filter((r) => r.name === player.name) : []
  const done = (d: string) => new Map(mine.filter((r) => r.day === d).map((r) => [r.game, r]))
  return {
    player,
    today: done(day),
    picked: done(sel),
    everyone: rows.filter((r) => r.day === sel),
    streak: streaks(mine, day).current,
    loaded: board.loaded,
    // Up to 8 friends who played most in the last week and have games left today, with how many they finished.
    friends: [...new Set(rows.filter((r) => r.day >= shiftDay(day, -7) && r.name !== player?.name).map((r) => r.name))]
      .map((n) => ({
        name: n,
        done: rows.filter((r) => r.name === n && r.day === day).length,
        days: new Set(rows.filter((r) => r.name === n && r.day >= shiftDay(day, -7)).map((r) => r.day)).size,
      }))
      .filter((f) => f.done < GAME_IDS.length)
      .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name))
      .slice(0, 8),
  }
}

/** Marks that the drawer already opened by itself this session. */
const OPENED = 'sfjc_daily_auto_opened'

/**
 * Draws a ring of 1 slice per daily game, filling a slice for each game finished today, like an activity ring.
 */
function Ring({ done, size }: { done: number; size: number }) {
  const r = 6.5,
    c = 2 * Math.PI * r,
    seg = c / GAME_IDS.length
  return (
    <svg aria-hidden viewBox="0 0 16 16" width={size} height={size} className="-rotate-90">
      {GAME_IDS.map((g, i) => (
        <circle
          key={g}
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
 * Renders the header Daily button, leaderboard link and the drawer they open. Game headers pass `compact` for a
 * smaller button without the leaderboard link, since they show their own.
 */
export function DailyHeader({ compact = false }: { compact?: boolean }) {
  /** Read only in the browser, so a server on another day (or a test clock) never mismatches the page. */
  const now = useSiteDay()
  const [picked, setPicked] = useState('')
  const sel = picked || now || siteDay()
  const [open, setOpen] = useState(false)
  const path = usePathname()
  const { player, today, picked: done, everyone, streak, loaded, friends } = useDaily(sel, open)
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
  const canNudge = isToday && friends.length > 0
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
  const risk = !!streak && !today.size
  const flame = (
    <span
      className={risk ? 'opacity-45 grayscale' : ''}
      title={risk ? `Play today to keep your ${streak} day streak` : `${streak} day streak`}
    >
      🔥{streak}
    </span>
  )
  const status = player
    ? `Daily, ${today.size} of ${GAME_IDS.length} done today${streak ? `, ${streak} day streak${risk ? ' at risk' : ''}` : ''}`
    : 'Daily'
  return (
    <div data-game-theme="daily" className="flex items-center gap-1.5 bg-transparent">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-label={status}
        onClick={() => {
          setPicked('')
          setOpen(true)
        }}
        className={
          'inline-flex items-center gap-1.5 rounded-full bg-[var(--ink-text)] font-semibold whitespace-nowrap ' +
          'text-[var(--ink-bg)] hover:opacity-90 ' +
          (compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm')
        }
      >
        Daily
        {player && <Ring done={today.size} size={compact ? 14 : 16} />}
        {player && !!streak && !compact && flame}
      </button>
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
            aria-label="Close daily drawer"
            onClick={close}
            className="absolute inset-0 bg-black/40"
          />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Daily games"
            style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
            className={
              'absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-[var(--ink-bg)] ' +
              'px-5 pt-2 pb-12 text-[var(--ink-text)] shadow-2xl transition-transform ' +
              'sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-96 sm:rounded-l-2xl sm:rounded-tr-none sm:p-5'
            }
          >
            <div {...sheet} className="-mx-5 -mt-2 touch-none px-5 pt-2 sm:hidden">
              <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--ink-border)]" />
            </div>
            <div {...sheet} className="mb-3 flex touch-none items-center gap-1 sm:mb-4 sm:touch-auto">
              <h2 className="text-xl font-bold tracking-tight">Daily</h2>
              <DayPicker day={sel} today={now} minDay={FIRST_DAY} go={setPicked} className="ml-auto" keys />
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-2 h-9 w-9 shrink-0 rounded-full text-xl hover:bg-[var(--ink-paper)]"
              >
                ×
              </button>
            </div>
            {player ? (
              <p className="mb-4 text-sm text-[var(--ink-muted)]">
                {today.size}/{GAME_IDS.length} today · {flame} · <PlayerName />
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
            <ul className="space-y-1.5 sm:space-y-2">
              {GAME_IDS.map((g) => {
                const r = done.get(g)
                const row = 'flex items-center gap-3 rounded-xl border border-[var(--ink-border)] p-2 sm:p-2.5'
                const icon = (
                  <Image
                    src={`/doodles/notebook/${g}.svg`}
                    alt=""
                    width={36}
                    height={36}
                    className="h-8 w-8 sm:h-9 sm:w-9"
                  />
                )
                // NYT games have no puzzle before their first day or after today, and the rest none before the epoch.
                if (sel < firstDay(g) || (isNytGame(g) && now && sel > now)) {
                  return (
                    <li key={g} className={`${row} opacity-40`}>
                      {icon}
                      <span className="flex-1 font-semibold">{GAMES[g].title}</span>
                      <span className="text-xs text-[var(--ink-muted)]">No puzzle</span>
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
                        <span className="flex-1 font-semibold">{GAMES[g].title}</span>
                      ) : (
                        <ViewTransition name={titleTransition(GAMES[g].url)}>
                          <span className="flex-1 font-semibold">{GAMES[g].title}</span>
                        </ViewTransition>
                      )}
                      {r ? (
                        <span className="text-sm font-semibold tabular-nums">{resultLabel(r)}</span>
                      ) : (
                        isPracticeResult(g, sel) && <span className="text-xs text-[var(--ink-muted)]">Practice</span>
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
            <section aria-label={`Scores for ${dayName}`} className="mt-4 sm:mt-5">
              <h3 className="mb-2 text-sm font-semibold text-[var(--ink-muted)]">
                {isToday ? "Today's scores" : `Scores · ${dayName}`}
              </h3>
              {everyone.length ? (
                <ScoreTable rows={everyone} me={player?.name} q={q} />
              ) : !loaded ? (
                <div role="status" aria-label="Loading scores" className="animate-pulse space-y-1.5">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-8 rounded-md bg-[var(--ink-border)]/40" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--ink-muted)]">
                  {now && sel > now
                    ? 'Future preview · practice only, not ranked.'
                    : `No scores ${isToday ? 'yet today' : 'this day'}.`}
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
                              : sent || `Nudge ${f.name}: ${GAME_IDS.length - f.done} games left today`
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
                          {f.done}/{GAME_IDS.length}
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
