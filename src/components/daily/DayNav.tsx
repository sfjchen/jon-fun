'use client'

/**
 * Renders the one shared header for every daily game: title, leaderboard and info icons, the day picker,
 * game-specific actions and, only when it matters, a note about score syncing.
 */

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ViewTransition, useEffect, useRef, useState } from 'react'
import ScoreSync from '@/components/daily/ScoreSync'
import DayPicker, { action } from '@/components/daily/DayPicker'
import { DailyHeader } from '@/components/daily/DailyDrawer'
import { HomeLink } from '@/components/HomeLink'
import PlayerName from '@/components/PlayerName'
import { DAILY_EPOCH } from '@/lib/daily'
import { SHARED_KEYS, type KeyRow } from '@/lib/game-keys'
import { useSiteDay } from '@/lib/play-day'
import { shelfOfPath } from '@/lib/results'

const icon =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ' +
  'border-[color-mix(in_srgb,var(--ink-text)_22%,transparent)] hover:bg-[var(--ink-border)]/40 [&>svg]:h-6 [&>svg]:w-6 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)]'
export { action, icon }

/**
 * Renders an ⓘ button that opens a small panel and closes on outside click or Escape. With `keys` the panel ends
 * with those keyboard shortcuts, on devices with a mouse.
 */
export function Info({ children, keys }: { children: React.ReactNode; keys?: KeyRow[] | undefined }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className={icon}
        aria-label="How to play"
        title="How to play"
        data-hotkey="?"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7.5v.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="How to play"
          className="absolute top-11 right-0 z-40 max-h-[75vh] w-[min(22rem,calc(100vw-2rem))] space-y-2 overflow-y-auto rounded-xl border p-4 text-sm shadow-lg"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          {children}
          {keys && (
            <dl className="hidden grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-t pt-2 text-xs [@media(hover:hover)]:grid">
              {keys.map(([key, does]) => (
                <div key={key + does} className="contents">
                  <dt className="flex flex-wrap gap-1">
                    {key.split(' ').map((k) => (
                      <kbd key={k} className="rounded border bg-[var(--ink-bg)] px-1 font-sans font-semibold">
                        {k}
                      </kbd>
                    ))}
                  </dt>
                  <dd style={{ color: 'var(--ink-muted)' }}>{does}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Renders the trophy link to the leaderboard, opened on `day` when given.
 */
export function BoardLink({ day, path = null }: { day?: string | undefined; path?: string | null }) {
  const query = [day && `d=${day}`, shelfOfPath(path) === 'beta' && 'shelf=beta'].filter(Boolean).join('&')
  return (
    <Link
      href={query ? `/leaderboards?${query}` : '/leaderboards'}
      className={icon}
      aria-label="Leaderboard"
      title="Leaderboard"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8" />
      </svg>
    </Link>
  )
}

/**
 * Names a game's title for page transitions, so the Daily drawer row and the game header morph into each other.
 */
export function titleTransition(path: string): string {
  return `title${path.replace(/[^a-z0-9]+/gi, '-')}`
}

type DayNavProps = {
  title: string
  minDay?: string
  publishedOnly?: boolean
  path: string
  /** The puzzle day. Omitted for practice puzzles, which show `label` instead. */
  day?: string | undefined
  label?: string
  /** Rules and notes shown in the ⓘ panel. */
  info: React.ReactNode
  /** The game's keyboard shortcuts, listed under the rules. */
  keys?: KeyRow[]
  /** Game-specific actions shown on the day row. */
  children?: React.ReactNode
}

/**
 * Renders the header. Day arrows step one day, the date field jumps anywhere, and Today returns to today.
 */
export default function DayNav({
  title,
  path,
  day,
  label,
  info,
  keys,
  children,
  minDay = DAILY_EPOCH,
  publishedOnly = false,
}: DayNavProps) {
  const router = useRouter()
  /** Read only in the browser, so a server on another day (or a test clock) never mismatches the page. */
  const today = useSiteDay()
  // A bare path can still show an unfinished puzzle from yesterday.
  const bare = !useSearchParams().get('d')
  const go = (d: string) => router.push(d === today && !bare ? path : `${path}?d=${d}`, { scroll: false })
  return (
    <header className="mb-3 space-y-1 border-b pb-2" style={{ borderColor: 'var(--ink-border)' }}>
      <div className="daily-heading flex min-h-12 items-center gap-1 sm:gap-2">
        <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
        <ViewTransition name={titleTransition(path)}>
          <h1 className="mr-auto min-w-0 truncate font-lora text-xl font-bold md:text-2xl">{title}</h1>
        </ViewTransition>
        <DailyHeader compact />
        <BoardLink day={day} path={path} />
        <Info keys={keys && [...keys, ...SHARED_KEYS]}>{info}</Info>
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {day ? (
          <DayPicker
            day={day}
            today={today}
            minDay={minDay}
            maxDay={publishedOnly ? today : undefined}
            go={go}
            className="mr-auto"
          />
        ) : (
          <p className="mr-auto text-sm" style={{ color: 'var(--ink-muted)' }}>
            {label}
          </p>
        )}
        <div className="ml-auto flex items-center gap-x-1">
          <PlayerName />
          {children}
        </div>
      </div>
      {day && today && day > today && (
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          Future preview · practice only, not ranked
        </p>
      )}
      <ScoreSync />
    </header>
  )
}
