import type { Metadata } from 'next'
import { ScoresHub } from '@/components/Scores'

export const metadata: Metadata = { title: 'Scores' }

export default function LeaderboardsPage() {
  return <ScoresHub />
}
