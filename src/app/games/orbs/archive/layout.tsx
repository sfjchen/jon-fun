/** Shared navigation for browsing and playing Orbs archive rounds. */

import Link from 'next/link'
import { HomeLink } from '@/components/HomeLink'
import { DailyHeader } from '@/components/daily/DailyDrawer'

export const metadata = { title: 'Orbs Archive' }

/** Wraps both archive routes in the daily-game header. */
export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="daily-heading mb-4 flex min-h-12 items-center gap-2 border-b border-[var(--ink-border)]">
        <HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center" />
        <h1 className="mr-auto font-lora font-bold">
          <Link href="/games/orbs/archive">Orbs Archive</Link>
        </h1>
        <DailyHeader compact />
      </header>
      {children}
    </div>
  )
}
