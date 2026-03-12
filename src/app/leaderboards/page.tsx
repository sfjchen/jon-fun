import Link from 'next/link'

const features = [
  'View global rankings for each game',
  'Compare your scores with friends',
  'Track your personal bests',
  'Earn achievements and badges',
]

export default function LeaderboardsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>
        🏆 Leaderboards
      </h1>

      <div
        className="rounded-lg border p-8"
        style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
      >
        <div className="mb-6 text-5xl">🚧</div>
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
        <Link href="/games/24">
          <button
            className="rounded-lg px-6 py-2 text-white transition-colors hover:opacity-95"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            🎯 Play 24 Game
          </button>
        </Link>
      </div>
    </div>
  )
}
