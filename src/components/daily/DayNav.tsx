'use client'

/**
 * Renders the one shared header for every daily game: title, leaderboard and info icons, the day picker,
 * game-specific actions and, only when it matters, a note about score syncing.
 */

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import ScoreSync from '@/components/daily/ScoreSync'
import DayPicker, { action } from '@/components/daily/DayPicker'
import { DailyHeader } from '@/components/daily/DailyDrawer'
import { HomeLink } from '@/components/HomeLink'
import PlayerName from '@/components/PlayerName'
import { DAILY_EPOCH, siteDay } from '@/lib/daily'

const icon =
  'inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--ink-border)]/40 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)]'
export { action }

/**
 * Renders an ⓘ button that opens a small panel and closes on outside click or Escape.
 */
export function Info({ children }: { children: React.ReactNode }) {
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
          className="absolute right-0 top-11 z-40 w-[min(20rem,calc(100vw-2rem))] space-y-2 rounded-xl border p-4 text-sm shadow-lg"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
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
  /** Game-specific actions shown on the day row. */
  children?: React.ReactNode
}

/**
 * Renders the header. Day arrows step one day, the date field jumps anywhere, and Today returns to today.
 */
export default function DayNav({ title, path, day, label, info, children, minDay = DAILY_EPOCH, publishedOnly = false }: DayNavProps) {
  const router = useRouter()
  /** Read only in the browser, so a server on another day (or a test clock) never mismatches the page. */
  const today = useSyncExternalStore(() => () => {}, siteDay, () => '')
  // A bare path keeps the day pinned when the page opened, so going to today from a game kept past midnight adds ?d=.
  const bare = !useSearchParams().get('d')
  const go = (d: string) => router.push(d === today && !bare ? path : `${path}?d=${d}`, { scroll: false })
  return (
    <header className="mb-3 space-y-1 border-b pb-2" style={{ borderColor: 'var(--ink-border)' }}>
      <div className="daily-heading flex min-h-12 items-center gap-1 sm:gap-2">
        <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
        <h1 className="mr-auto min-w-0 truncate font-lora text-xl font-bold md:text-2xl">{title}</h1>
        <DailyHeader compact />
        <Link href={day ? `/leaderboards?d=${day}` : '/leaderboards'} className={icon} aria-label="Leaderboard" title="Leaderboard">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8" />
          </svg>
        </Link>
        <Info>{info}</Info>
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {day ? (
          <DayPicker day={day} today={today} minDay={minDay} maxDay={publishedOnly ? today : undefined} go={go} className="mr-auto" />
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
      {day && today && day > today && <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Future preview · practice only, not ranked</p>}
      <ScoreSync />
    </header>
  )
}
