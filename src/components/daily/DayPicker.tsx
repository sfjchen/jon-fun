'use client'

/*
 * Day stepper shared by the game header and the Daily drawer: ‹ and › step 1 day, the date field jumps anywhere in
 * range, and Today returns to today. The left and right arrow keys step days and T returns to today.
 */

import { useEffect, useRef } from 'react'
import { shiftDay, validDay } from '@/lib/daily'
import { isTypingTarget } from '@/lib/keyboard'

/** Whether the player last used a day picker, which keeps the arrow keys on it until they click or type elsewhere. */
let armed = false

export const action =
  'rounded-full px-2 py-1.5 text-[13px] hover:bg-[var(--ink-border)]/40 disabled:opacity-30 sm:px-2.5 sm:text-sm'

type DayPickerProps = {
  day: string
  /** Today's site day, or '' before hydration, which hides Today. */
  today: string
  minDay: string
  /** The last day allowed, or undefined to allow future days. */
  maxDay?: string | undefined
  go: (day: string) => void
  className?: string
  /** Makes the arrow keys step days whenever the picker is on screen, for pages where nothing else uses them. */
  keys?: boolean
}

/** Shared box for the joined arrows and date field, so each arrow is a full-height button, not just its glyph. */
const arrow =
  'flex w-8 items-center justify-center text-lg leading-none hover:bg-[var(--ink-border)]/40 disabled:pointer-events-none ' +
  'disabled:opacity-30 sm:w-9'

/**
 * Renders the arrows and date field as 1 joined box, plus a Today button off today, calling `go` with any valid day
 * the player picks.
 */
export default function DayPicker({ day, today, minDay, maxDay, go, className = '', keys = false }: DayPickerProps) {
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = nav.current,
        t = e.target as HTMLElement | null,
        inside = !!el?.contains(t)
      if (!el || e.metaKey || e.ctrlKey || e.altKey || e.isComposing || (inside && t?.tagName === 'INPUT')) return
      const modal = document.querySelector('[aria-modal="true"]')
      if (modal && !modal.contains(el)) return
      const typing = isTypingTarget(t)
      if (!(inside || armed || (keys && !typing))) return
      const to =
        e.key === 'ArrowLeft'
          ? shiftDay(day, -1)
          : e.key === 'ArrowRight'
            ? shiftDay(day, 1)
            : e.key.toLowerCase() === 't' && !typing
              ? today
              : ''
      if (!to) {
        if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key.startsWith('Arrow')) armed = false
        return
      }
      e.preventDefault()
      e.stopPropagation()
      if (to !== day && to >= minDay && (maxDay === undefined || to <= maxDay)) go(to)
    }
    const onPointer = (e: PointerEvent) => {
      armed = !!nav.current?.contains(e.target as Node)
    }
    // Runs before the game's own key handlers, so the arrows keep stepping days while the picker is in use.
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  })
  return (
    <nav ref={nav} aria-label="Puzzle date" className={`flex items-center gap-1 text-sm sm:gap-1.5 ${className}`}>
      <div className="flex h-9 items-stretch divide-x divide-[var(--ink-border)] overflow-hidden rounded-lg border border-[var(--ink-border)]">
        <button
          type="button"
          className={arrow}
          aria-label="Previous day"
          title="Previous day"
          disabled={day <= minDay}
          onClick={() => go(shiftDay(day, -1))}
        >
          ‹
        </button>
        <input
          type="date"
          aria-label="Puzzle date"
          title="Pick a day"
          className="w-[7.25rem] bg-transparent px-1.5 text-[13px] sm:w-[8.25rem] sm:px-2 sm:text-sm"
          max={maxDay}
          min={minDay}
          value={day}
          onChange={(e) =>
            validDay(e.target.value) &&
            e.target.value >= minDay &&
            (maxDay === undefined || e.target.value <= maxDay) &&
            go(e.target.value)
          }
        />
        <button
          type="button"
          className={arrow}
          aria-label="Next day"
          title="Next day"
          disabled={maxDay !== undefined && day >= maxDay}
          onClick={() => go(shiftDay(day, 1))}
        >
          ›
        </button>
      </div>
      {today && day !== today && (
        <button
          type="button"
          className="h-9 rounded-lg border border-[var(--ink-border)] px-2 text-xs font-medium hover:bg-[var(--ink-border)]/40 sm:px-2.5"
          onClick={() => go(today)}
        >
          Today
        </button>
      )}
    </nav>
  )
}
