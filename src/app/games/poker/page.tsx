'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PokerJoinForm from '@/components/PokerJoinForm'

export default function PokerPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [hostName, setHostName] = useState('')
  const [joinPin, setJoinPin] = useState('')
  const [smallBlind, setSmallBlind] = useState(5)
  const [bigBlind, setBigBlind] = useState(10)
  const [timerPerTurn, setTimerPerTurn] = useState(40)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/poker/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: hostName.trim(),
          smallBlind,
          bigBlind,
          timerPerTurn,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create room')
      }

      // Store host ID in sessionStorage
      sessionStorage.setItem('poker_hostId', data.hostId)
      sessionStorage.setItem('poker_playerId', data.playerId || data.hostId)
      sessionStorage.setItem('poker_playerName', hostName.trim())

      router.push(`/games/poker/lobby/${data.pin}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
      setLoading(false)
    }
  }

  const [showPositionSelection, setShowPositionSelection] = useState(false)

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!/^\d{4}$/.test(joinPin)) {
      setError('Please enter a valid 4-digit PIN')
      return
    }

    // Show position selection
    setShowPositionSelection(true)
  }

  const handleJoinWithPosition = async (playerName: string, position: number) => {
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`/api/poker/rooms/${joinPin}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          playerName: playerName.trim(),
          position,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join room')
      }

      // Store player info
      sessionStorage.setItem('poker_playerId', data.playerId)
      sessionStorage.setItem('poker_playerName', playerName.trim())

      router.push(`/games/poker/lobby/${joinPin}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-4">🃏 Texas Hold&apos;em</h1>
            <p className="text-xl text-gray-300">Poker Chip Tracker</p>
          </header>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setMode('create')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  mode === 'create'
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                Create Room
              </button>
              <button
                onClick={() => setMode('join')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  mode === 'join'
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                Join Room
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            {mode === 'create' ? (
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-white mb-2">Your Name</label>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter your name"
                    required
                    maxLength={20}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-white mb-2">Small Blind</label>
                    <input
                      type="number"
                      value={smallBlind}
                      onChange={(e) => setSmallBlind(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white mb-2">Big Blind</label>
                    <input
                      type="number"
                      value={bigBlind}
                      onChange={(e) => setBigBlind(Math.max(smallBlind * 2, parseInt(e.target.value) || smallBlind * 2))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      min={smallBlind * 2}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white mb-2">Timer (seconds)</label>
                    <input
                      type="number"
                      value={timerPerTurn}
                      onChange={(e) => setTimerPerTurn(Math.max(5, Math.min(300, parseInt(e.target.value) || 40)))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      min="5"
                      max="300"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !hostName.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Room'}
                </button>
              </form>
            ) : showPositionSelection ? (
              <div>
                <div className="mb-4">
                  <button
                    onClick={() => setShowPositionSelection(false)}
                    className="text-white hover:text-gray-300 mb-2"
                  >
                    ← Back to PIN entry
                  </button>
                </div>
                <PokerJoinForm
                  pin={joinPin}
                  onJoin={handleJoinWithPosition}
                  onCancel={() => setShowPositionSelection(false)}
                  loading={loading}
                  error={error}
                />
              </div>
            ) : (
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label className="block text-white mb-2">Room PIN</label>
                  <input
                    type="text"
                    value={joinPin}
                    onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-widest"
                    placeholder="0000"
                    maxLength={4}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!joinPin || joinPin.length !== 4}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Continue to Select Seat
                </button>
              </form>
            )}
          </div>

          <div className="mt-8 text-center text-gray-400 text-sm">
            <p>Use physical cards, track chips digitally</p>
            <p className="mt-2">Share the room PIN with friends to play together</p>
          </div>
        </div>
      </div>
    </div>
  )
}

