'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'

const games = [
  {
    id: '24',
    title: '24 Game',
    description: 'Use 4 numbers and basic arithmetic to make 24',
    icon: '🎯',
    href: '/games/24',
    tags: ['Math', 'Logic', 'Puzzle'],
    available: true,
  },
  {
    id: 'jeopardy',
    title: 'Jeopardy with Friends',
    description: 'Create and play custom Jeopardy boards locally',
    icon: '❓',
    href: '/games/jeopardy',
    tags: ['Party', 'Trivia'],
    available: true,
  },
  {
    id: 'poker',
    title: 'Texas Hold\'em',
    description: 'Poker chip tracker with real-time multiplayer lobbies',
    icon: '/poker-table.svg',
    href: '/games/poker',
    tags: ['Card', 'Multiplayer'],
    available: true,
  },
  {
    id: 'chwazi',
    title: 'Chwazi Finger Chooser',
    description: 'Place fingers on screen to randomly select a winner',
    icon: '👆',
    href: '/games/chwazi',
    tags: ['Utility', 'Party', 'Mobile'],
    available: true,
  },
  {
    id: 'coming-soon',
    title: 'Coming Soon',
    description: 'More brain games are in development',
    icon: '🚧',
    href: '#',
    tags: ['TBD'],
    available: false,
  },
]

const features = [
  {
    id: 'leaderboards',
    title: 'Leaderboards',
    description: 'See the best scores and compete with others',
    icon: '🏆',
    href: '/leaderboards',
    tags: ['Global', 'Friends'],
    available: true,
  },
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">Game Hub</h1>
          <p className="text-xl text-gray-300">Collection of fun brain games</p>
        </header>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onComingSoonClick={() => setShowComingSoon(true)}
            />
          ))}

          {features.map((feature) => (
            <GameCard
              key={feature.id}
              game={feature}
              onComingSoonClick={() => setShowComingSoon(true)}
            />
          ))}
        </div>

        {/* Coming Soon Modal */}
        {showComingSoon && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">🚧 Coming Soon</h2>
                <button
                  onClick={() => setShowComingSoon(false)}
                  className="text-white hover:text-gray-300 text-2xl font-bold"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>

              <p className="text-gray-300 mb-6 text-lg">
                We&apos;re working hard to bring you these exciting new features:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {futureFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-blue-400 mr-3 mt-1 text-lg">•</span>
                    <span className="text-white text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowComingSoon(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

interface GameCardProps {
  game: {
    id: string
    title: string
    description: string
    icon: string // Can be emoji or image path
    href: string
    tags: string[]
    available: boolean
  }
  onComingSoonClick: () => void
}

function GameCard({ game, onComingSoonClick }: GameCardProps) {
  const CardContent = () => (
    <div className="text-center">
      <div className="mb-4 flex justify-center items-center h-16">
        {game.icon.startsWith('/') ? (
          <Image
            src={game.icon}
            alt={game.title}
            width={64}
            height={64}
            className="h-14 w-14 sm:h-16 sm:w-16 object-contain drop-shadow-lg"
            priority
          />
        ) : (
          <span className="text-5xl leading-none">{game.icon}</span>
        )}
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{game.title}</h2>
      <p className="text-gray-300 mb-4">{game.description}</p>
      <div className="flex justify-center space-x-2 mb-4">
        {game.tags.map((tag) => (
          <span
            key={tag}
            className={`px-2 py-1 rounded text-sm ${game.available
              ? 'bg-blue-500 text-white'
              : 'bg-gray-500 text-white'
              }`}
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="text-sm text-gray-500">
        {game.available ? 'Click to play →' : 'Click to see features →'}
      </div>
    </div>
  )

  if (!game.available) {
    return (
      <button
        onClick={onComingSoonClick}
        className="w-full bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-300 transform hover:scale-105 text-left"
      >
        <CardContent />
      </button>
    )
  }

  return (
    <Link href={game.href} className="group">
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all duration-300 transform hover:scale-105 border border-white/20">
        <CardContent />
      </div>
    </Link>
  )
}
