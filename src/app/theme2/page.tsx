'use client'

import Image from 'next/image'
import { useState } from 'react'
import { GameCard } from '@/components/GameCard'
import type { GameCardGame } from '@/components/GameCard'

const items: GameCardGame[] = [
  { id: 'tmr', title: 'TMR System', description: 'Targeted Memory Reactivation for learning and sleep', icon: '/doodles/tmr.svg', href: '/theme2/games/tmr', available: true },
  { id: 'daily-log', title: '1 Sentence Everyday', description: 'One sentence per day; history, calendar, export', icon: '/doodles/daily.svg', href: '/theme2/games/daily-log', available: true },
  { id: 'pear-navigator', title: 'Pear Navigator', description: 'Step-by-step guides for Procreate, Figma', icon: '/doodles/pear.svg', href: '/theme2/games/pear-navigator', available: true },
  { id: '24', title: '24 (Jon\'s favorite)', description: '4 numbers, basic arithmetic → make 24', icon: '/doodles/game24.svg', href: '/theme2/games/24', available: true },
  { id: 'jeopardy', title: 'Jeopardy with Friends', description: 'Create and play custom boards locally', icon: '/doodles/jeopardy.svg', href: '/theme2/games/jeopardy', available: true },
  { id: 'poker', title: 'Texas Hold\'em', description: 'Chip tracker with multiplayer lobbies', icon: '/doodles/poker.svg', href: '/theme2/games/poker', available: true },
  { id: 'chwazi', title: 'Chwazi Finger Chooser', description: 'Touch screen to pick a winner', icon: '/doodles/chwazi.svg', href: '/theme2/games/chwazi', available: true },
  {
    id: 'mental-obstacle-course',
    title: 'Mental Obstacle Course',
    description: 'Six-round brain benchmark: reaction, math, patterns, memory, words, trivia — radar chart (local scores)',
    icon: '/doodles/obstacle.svg',
    href: '/theme2/games/mental-obstacle-course',
    available: true,
  },
  {
    id: 'quip-clash',
    title: 'Quip Clash',
    description: 'PIN room party game: paired prompts, votes, final round (Supabase + Realtime)',
    icon: '/doodles/jeopardy.svg',
    href: '/theme2/games/quip-clash',
    available: true,
  },
  {
    id: 'fib-it',
    title: 'Fib It',
    description: 'Bluff-the-truth trivia: lies, picks, likes — 2–8 players',
    icon: '/doodles/game24.svg',
    href: '/theme2/games/fib-it',
    available: true,
  },
  {
    id: 'enough-about-you',
    title: 'Enough About You',
    description: 'Private intake, personal bluff rounds, final truth-vs-lie vote',
    icon: '/doodles/daily.svg',
    href: '/theme2/games/enough-about-you',
    available: true,
  },
  { id: 'leaderboards', title: 'Leaderboards', description: 'Scores and rankings', icon: '/doodles/leaderboards.svg', href: '/theme2/leaderboards', available: true },
  { id: 'coming-soon', title: 'Coming Soon', description: 'More brain games in development', icon: '/doodles/coming-soon.svg', href: '#', available: false },
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

export default function Theme2Home() {
  const [showComingSoon, setShowComingSoon] = useState(false)

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl">
        {items.map((item) => (
          <GameCard key={item.id} game={item} onComingSoonClick={() => setShowComingSoon(true)} />
        ))}
      </div>

      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border p-8"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-lora text-2xl font-semibold flex items-center gap-2" style={{ color: 'var(--ink-text)' }}>
                <Image src="/doodles/coming-soon.svg" alt="" width={32} height={32} className="h-8 w-8" />
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
