import type { Metadata } from 'next'
import { MultiplayerBoard } from '@/components/MultiplayerBoard'
import { ScoresHub } from '@/components/Scores'

export const metadata: Metadata = { title: 'Leaderboard' }

/**
 * Shows the Daily leaderboard, or the Multiplayer room leaderboard for ?tab=multiplayer.
 */
export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (await searchParams).tab === 'multiplayer' ? <MultiplayerBoard /> : <ScoresHub />
}
