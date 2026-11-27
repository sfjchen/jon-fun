import Link from 'next/link'
import { firstDay, shiftDay, siteDay } from '@/lib/daily'

export const metadata = { title: 'Chainle Archive' }
export const dynamic = 'force-dynamic'

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function Page() {
  const today = siteDay()
  const first = firstDay('chainle')
  const months = new Map<string, string[]>()
  for (let day = shiftDay(today, -1); day >= first; day = shiftDay(day, -1)) {
    const month = day.slice(0, 7)
    const days = months.get(month) ?? []
    days.push(day)
    months.set(month, days)
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-lora text-2xl font-bold">Chainle Archive</h1>
        <Link className="text-sm font-medium underline" href="/games/chainle">
          Play today
        </Link>
      </div>
      {[...months].map(([month, days], i) => (
        <details
          key={month}
          open={i === 0}
          className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-3"
        >
          <summary className="cursor-pointer font-semibold">{monthFormat.format(new Date(month + '-01'))}</summary>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {days.map((day) => (
              <li key={day}>
                <Link
                  className="block rounded-lg border border-[var(--ink-border)] p-2 text-sm underline"
                  href={'/games/chainle?d=' + day}
                  prefetch={false}
                >
                  {day}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}
