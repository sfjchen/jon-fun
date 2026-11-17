'use client'
import Link from 'next/link'
import { DAILY_EPOCH, shiftDay, siteDay } from '@/lib/daily'
export default function DayNav({ day, path, sourceDate }: { day: string; path: string; sourceDate?: string | undefined }) {
  const href = (d: string) => `${path}?d=${d}`
  return <div className="space-y-2">
    <nav aria-label="Puzzle date" className="flex flex-wrap items-center gap-3 text-sm">
      {day > DAILY_EPOCH ? <Link className="rounded border px-3 py-2" aria-label="Previous day" href={href(shiftDay(day, -1))}>←</Link> : <span className="px-3 opacity-30">←</span>}
      <label className="flex items-center gap-2">Date <input aria-label="Puzzle date" className="rounded border bg-[var(--ink-paper)] p-2" type="date" min={DAILY_EPOCH} value={day} onChange={e => { if (e.target.value >= DAILY_EPOCH && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) window.location.assign(href(e.target.value)) }} /></label>
      <Link className="rounded border px-3 py-2" aria-label="Next day" href={href(shiftDay(day, 1))}>→</Link>
      <Link className="underline" href={path}>Today</Link><Link className="underline" href={`/leaderboards?d=${day}`}>Scores</Link>
    </nav>
    {day > siteDay() && <p className="text-sm">Future practice · previews stay unranked.</p>}
    {sourceDate && sourceDate !== day && <p className="text-xs text-[var(--ink-muted)]">Daily selection from the {sourceDate} archive puzzle. Everyone gets the same puzzle.</p>}
  </div>
}
