'use client'

import Image from 'next/image'
import Link from 'next/link'

const features = [
  'View global rankings for each game',
  'Compare your scores with friends',
  'Track your personal bests',
  'Earn achievements and badges',
]

export default function NotebookLeaderboardsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-lora text-2xl font-semibold flex items-center gap-2" style={{ color: 'var(--ink-text)' }}>
        <Image src="/doodles/notebook/leaderboards.svg" alt="" width={32} height={32} className="h-8 w-8" />
        Leaderboards
      </h1>

      <div
        className="rounded-lg border p-8 bg-transparent"
        style={{ borderColor: 'var(--ink-border)' }}
      >
        <div className="mb-6">
          <Image src="/doodles/notebook/coming-soon.svg" alt="" width={64} height={64} className="h-16 w-16" />
        </div>
        <h2 className="mb-4 font-lora text-xl font-semibold" style={{ color: 'var(--ink-text)' }}>
          Coming Soon!
        </h2>
        <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
          Leaderboards are currently in development. Soon you&apos;ll be able to:
        </p>
        <ul className="mb-8 space-y-2" style={{ color: 'var(--ink-text)' }}>
          {features.map((feature, index) => (
            <li key={index} className="flex items-center">
              <span className="mr-2" style={{ color: 'var(--ink-accent)' }}>✓</span>
              {feature}
            </li>
          ))}
        </ul>
        <Link href="/notebook/games/24">
          <button
            className="rounded-lg px-6 py-2 text-white transition-colors hover:opacity-95 flex items-center gap-2 justify-center"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            <Image src="/doodles/notebook/game24.svg" alt="" width={20} height={20} className="h-5 w-5 invert" />
            Play 24 Game
          </button>
        </Link>
      </div>
    </div>
  )
}
