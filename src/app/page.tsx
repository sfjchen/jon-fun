'use client'

import Image from 'next/image'
import { useState } from 'react'
import { GameCard } from '@/components/GameCard'
import type { GameCardGame } from '@/components/GameCard'

const nb = '/doodles/notebook'
/** Pear Navigator card archived — restore from `@/data/notebook-home-games-archive` */
const items: GameCardGame[] = [
  { id: 'tmr', title: 'TMR System', description: 'Targeted Memory Reactivation for learning and sleep', icon: `${nb}/tmr.svg`, href: '/games/tmr', available: true },
  { id: 'daily-log', title: '1 Sentence Everyday', description: 'One sentence per day; history, calendar, export', icon: `${nb}/daily.svg`, href: '/games/daily-log', available: true },
  { id: '24', title: '24 (Jon\'s favorite)', description: '4 numbers, basic arithmetic → make 24', icon: `${nb}/game24.svg`, href: '/games/24', available: true },
  { id: 'jeopardy', title: 'Jeopardy with Friends', description: 'Create and play custom boards locally', icon: `${nb}/jeopardy.svg`, href: '/games/jeopardy', available: true },
  { id: 'poker', title: 'Texas Hold\'em', description: 'Chip tracker with multiplayer lobbies', icon: `${nb}/poker.svg`, href: '/games/poker', available: true },
  { id: 'chwazi', title: 'Chwazi Finger Chooser', description: 'Touch screen to pick a winner', icon: `${nb}/chwazi.svg`, href: '/games/chwazi', available: true },
  {
    id: 'mental-obstacle-course',
    title: 'Mental Obstacle Course',
    description: 'Six-round brain benchmark: reaction, math, patterns, memory, words, trivia — radar chart (local scores)',
    icon: `${nb}/obstacle.svg`,
    href: '/games/mental-obstacle-course',
    available: true,
  },
  { id: 'leaderboards', title: 'Leaderboards', description: 'Scores and rankings', icon: `${nb}/leaderboards.svg`, href: '/leaderboards', available: true },
  { id: 'coming-soon', title: 'Coming Soon', description: 'More brain games in development', icon: `${nb}/coming-soon.svg`, href: '#', available: false },
]

const futureFeatures = [
  'Zetamac, typing speed, logic puzzles, hypothetical scenarios, life hacks',
  'Poker chip tracker lobbies, personalized kahoot',
  'User accounts',
  'Real-time multiplayer lobbies',
  'Friend system and invitations',
  'Custom game settings and difficulty levels',
  'Chat system for multiplayer games',
  'Personal game history and statistics',
]

export default function Home() {
  const [showComingSoon, setShowComingSoon] = useState(false)

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl">
        {items.map((item) => (
          <GameCard key={item.id} game={item} onComingSoonClick={() => setShowComingSoon(true)} linePaper compact />
        ))}
      </div>

      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border p-6 shadow-lg"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-lora text-2xl font-semibold flex items-center gap-2" style={{ color: 'var(--ink-text)' }}>
                <Image src="/doodles/notebook/coming-soon.svg" alt="" width={32} height={32} className="h-8 w-8" />
                Coming Soon
              </h2>
              <button
                onClick={() => setShowComingSoon(false)}
                className="text-xl font-bold hover:opacity-70"
                style={{ color: 'var(--ink-text)' }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <p className="mb-4" style={{ color: 'var(--ink-muted)' }}>
              We&apos;re working hard to bring you these exciting new features:
            </p>

            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              {futureFeatures.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start rounded-lg border p-3"
                  style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}
                >
                  <span className="mr-3 mt-1 text-lg" style={{ color: 'var(--ink-accent)' }}>•</span>
                  <span className="text-sm" style={{ color: 'var(--ink-text)' }}>{feature}</span>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowComingSoon(false)}
                className="rounded-lg px-6 py-2 text-white transition-colors hover:opacity-95"
                style={{ backgroundColor: 'var(--ink-accent)' }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
