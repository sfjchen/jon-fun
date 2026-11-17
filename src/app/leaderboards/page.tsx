import type { Metadata } from 'next'
import { ScoresHub } from '@/components/Scores'

export const metadata: Metadata = { title: 'Leaderboard' }

export default function LeaderboardsPage() {
  return <ScoresHub />
}
