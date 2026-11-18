import type { Metadata } from 'next'
import Link from 'next/link'
import { MultiplayerBoard } from '@/components/MultiplayerBoard'
import { ScoresHub } from '@/components/Scores'

export const metadata: Metadata = { title: 'Leaderboard' }

/**
 * Shows the Daily scores by default and the Multiplayer room leaderboard for ?tab=multiplayer.
 */
export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const multi = (await searchParams).tab === 'multiplayer'
  const tab = (on: boolean) =>
    `rounded-full px-4 py-1.5 text-sm ${on ? 'bg-[var(--ink-accent)] text-white' : 'border border-[var(--ink-border)]'}`
  return (
    <>
      <nav className="mx-auto mb-3 flex max-w-4xl gap-2">
        <Link href="/leaderboards" className={tab(!multi)}>Daily</Link>
        <Link href="/leaderboards?tab=multiplayer" className={tab(multi)}>Multiplayer</Link>
      </nav>
      {multi ? <MultiplayerBoard /> : <ScoresHub />}
    </>
  )
}
