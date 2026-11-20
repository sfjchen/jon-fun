'use client'

/*
 * Day stepper shared by the game header and the Daily drawer: ‹ and › step 1 day, the date field jumps anywhere in
 * range, and Today returns to today.
 */

import { shiftDay, validDay } from '@/lib/daily'

export const action = 'rounded-full px-2 py-1.5 text-[13px] hover:bg-[var(--ink-border)]/40 disabled:opacity-30 sm:px-2.5 sm:text-sm'

type DayPickerProps = {
  day: string
  /** Today's site day, or '' before hydration, which hides Today. */
  today: string
  minDay: string
  /** The last day allowed, or undefined to allow future days. */
  maxDay?: string | undefined
  go: (day: string) => void
  className?: string
}

/**
 * Renders the arrows, date field and Today button, calling `go` with any valid day the player picks.
 */
export default function DayPicker({ day, today, minDay, maxDay, go, className = '' }: DayPickerProps) {
  return (
    <nav aria-label="Puzzle date" className={`flex items-center text-sm ${className}`}>
      <button
        type="button"
        className={action}
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
        className="w-[7.5rem] rounded-md bg-transparent py-1 text-[13px] sm:w-auto sm:px-1 sm:text-sm"
        max={maxDay}
        min={minDay}
        value={day}
        onChange={(e) => validDay(e.target.value) && e.target.value >= minDay && (maxDay === undefined || e.target.value <= maxDay) &&
            go(e.target.value)}
      />
      <button
        type="button"
        className={action}
        aria-label="Next day"
        title="Next day"
        disabled={maxDay !== undefined && day >= maxDay}
        onClick={() => go(shiftDay(day, 1))}
      >
        ›
      </button>
      {today && day !== today && (
        <button type="button" className={`${action} underline`} onClick={() => go(today)}>
          Today
        </button>
      )}
    </nav>
  )
}
