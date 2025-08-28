import Link from 'next/link'

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
  'User accounts and authentication',
  'Real-time multiplayer lobbies',
  'Friend system and invitations',
  'Tournament brackets and competitions',
  'Custom game settings and difficulty levels',
  'Achievement system and badges',
  'Chat system for multiplayer games',
  'Spectator mode for watching games',
  'Personal game history and statistics',
  'Mobile app with push notifications',
]

export default function Home() {
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
            <GameCard key={game.id} game={game} />
          ))}
          
          {features.map((feature) => (
            <GameCard key={feature.id} game={feature} />
          ))}
        </div>

        {/* Footer */}
        <footer className="text-center mt-16 text-gray-400">
          <p>© 2024 Game Hub</p>
        </footer>
      </div>
    </div>
  )
}

interface GameCardProps {
  game: {
    id: string
    title: string
    description: string
    icon: string
    href: string
    tags: string[]
    available: boolean
  }
}

function GameCard({ game }: GameCardProps) {
  const CardContent = () => (
    <div className="text-center">
      <div className="text-4xl mb-4">{game.icon}</div>
      <h2 className="text-2xl font-bold text-white mb-2">{game.title}</h2>
      <p className="text-gray-300 mb-4">{game.description}</p>
      <div className="flex justify-center space-x-2 mb-4">
        {game.tags.map((tag) => (
          <span
            key={tag}
            className={`px-2 py-1 rounded text-sm ${
              game.available
                ? 'bg-blue-500 text-white'
                : 'bg-gray-500 text-white'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="text-sm text-gray-500">
        {game.available ? 'Click to play →' : 'Stay tuned!'}
      </div>
    </div>
  )

  if (!game.available) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 opacity-60">
        <CardContent />
        <div className="mt-6 text-left">
          <h3 className="text-lg font-semibold text-white mb-3">Future Features:</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            {futureFeatures.map((feature, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-400 mr-2 mt-1">•</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
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
