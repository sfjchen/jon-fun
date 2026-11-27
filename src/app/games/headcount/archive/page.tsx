/** Headcount archive page: every past party by date, in the daily-game header. */

import Link from 'next/link'
import { HomeLink } from '@/components/HomeLink'
import { DailyHeader } from '@/components/daily/DailyDrawer'
import { firstDay, shiftDay, siteDay } from '@/lib/daily'
import HeadcountArchive from './list'

export const metadata = { title: 'Headcount Archive' }
export const dynamic = 'force-dynamic'

/**
 * Lists the parties from yesterday back to the first one, so the archive never spoils today's.
 */
export default function Page() {
  const days: string[] = []
  for (let day = shiftDay(siteDay(), -1); day >= firstDay('headcount'); day = shiftDay(day, -1)) days.push(day)
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="daily-heading mb-4 flex min-h-12 items-center gap-2 border-b border-[var(--ink-border)]">
        <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
        <h1 className="mr-auto font-lora font-bold">Headcount Archive</h1>
        <Link className="text-sm underline" href="/games/headcount">
          Play today
        </Link>
        <DailyHeader compact />
      </header>
      <HeadcountArchive days={days} />
    </div>
  )
}
