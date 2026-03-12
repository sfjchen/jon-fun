'use client'

import { useState } from 'react'
import { GameCard } from '@/components/GameCard'
import type { GameCardGame } from '@/components/GameCard'

const items: GameCardGame[] = [
  { id: 'tmr', title: 'TMR System', description: 'Targeted Memory Reactivation for enhanced learning and memory consolidation', icon: '🔊', href: '/games/tmr', available: true },
  { id: 'daily-log', title: '1 Sentence Everyday', description: 'Log one sentence (or more) per day; view history, calendar, and export', icon: '📝', href: '/games/daily-log', available: true },
  { id: 'pear-navigator', title: 'Pear Navigator', description: 'Step-by-step guide with AI-style highlight overlay for creative apps (Procreate, Figma)', icon: '🍐', href: '/games/pear-navigator', available: true },
  { id: '24', title: '24 Game', description: 'Use 4 numbers and basic arithmetic to make 24', icon: '🎯', href: '/games/24', available: true },
  { id: 'jeopardy', title: 'Jeopardy with Friends', description: 'Create and play custom Jeopardy boards locally', icon: '❓', href: '/games/jeopardy', available: true },
  { id: 'poker', title: 'Texas Hold\'em', description: 'Poker chip tracker with real-time multiplayer lobbies', icon: '/poker-table.svg', href: '/games/poker', available: true },
  { id: 'chwazi', title: 'Chwazi Finger Chooser', description: 'Place fingers on screen to randomly select a winner', icon: '👆', href: '/games/chwazi', available: true },
  { id: 'leaderboards', title: 'Leaderboards', description: 'See the best scores and compete with others', icon: '🏆', href: '/leaderboards', available: true },
  { id: 'coming-soon', title: 'Coming Soon', description: 'More brain games are in development', icon: '🚧', href: '#', available: false },
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
          <GameCard key={item.id} game={item} onComingSoonClick={() => setShowComingSoon(true)} />
        ))}
      </div>

      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border p-8"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>
                🚧 Coming Soon
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

            <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
              We&apos;re working hard to bring you these exciting new features:
            </p>

            <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2">
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
