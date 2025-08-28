import Link from 'next/link'

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
          {/* 24 Game */}
          <Link href="/games/24" className="group">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all duration-300 transform hover:scale-105 border border-white/20">
              <div className="text-center">
                <div className="text-4xl mb-4">🎯</div>
                <h2 className="text-2xl font-bold text-white mb-2">24 Game</h2>
                <p className="text-gray-300 mb-4">
                  Use 4 numbers and basic arithmetic to make 24
                </p>
                <div className="flex justify-center space-x-2 mb-4">
                  <span className="bg-red-500 text-white px-2 py-1 rounded text-sm">Math</span>
                  <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm">Logic</span>
                  <span className="bg-green-500 text-white px-2 py-1 rounded text-sm">Puzzle</span>
                </div>
                <div className="text-sm text-gray-500">
                  Click to play →
                </div>
              </div>
            </div>
          </Link>

          {/* Coming Soon Games */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 opacity-60">
            <div className="text-center">
              <div className="text-4xl mb-4">🚧</div>
              <h2 className="text-2xl font-bold text-white mb-2">Coming Soon</h2>
              <p className="text-gray-300 mb-4">
                More brain games are in development
              </p>
              <div className="flex justify-center space-x-2 mb-4">
                <span className="bg-gray-500 text-white px-2 py-1 rounded text-sm">TBD</span>
              </div>
              <div className="text-sm text-gray-500">
                Stay tuned!
              </div>
            </div>
          </div>

          {/* Leaderboards */}
          <Link href="/leaderboards" className="group">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all duration-300 transform hover:scale-105 border border-white/20">
              <div className="text-center">
                <div className="text-4xl mb-4">🏆</div>
                <h2 className="text-2xl font-bold text-white mb-2">Leaderboards</h2>
                <p className="text-gray-300 mb-4">
                  See the best scores and compete with others
                </p>
                <div className="flex justify-center space-x-2 mb-4">
                  <span className="bg-yellow-500 text-white px-2 py-1 rounded text-sm">Global</span>
                  <span className="bg-purple-500 text-white px-2 py-1 rounded text-sm">Friends</span>
                </div>
                <div className="text-sm text-gray-500">
                  View rankings →
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <footer className="text-center mt-16 text-gray-400">
          <p>© 2024 Game Hub</p>
        </footer>
      </div>
    </div>
  )
}
