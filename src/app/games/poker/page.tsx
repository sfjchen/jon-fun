'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PokerJoinForm from '@/components/PokerJoinForm'

export default function PokerPage() {
  const router = useRouter()
  const base = ''
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

      router.push(`${base}/games/poker/lobby/${data.pin}`)
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

      router.push(`${base}/games/poker/lobby/${joinPin}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl py-2">
      <div className="mx-auto max-w-2xl">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold font-lora mb-4" style={{ color: 'var(--ink-text)' }}>🃏 Texas Hold&apos;em</h1>
          <p className="text-xl" style={{ color: 'var(--ink-muted)' }}>Poker Chip Tracker</p>
        </header>

        <div className="rounded-lg p-8 border shadow-sm" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setMode('create')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold ${
                  mode === 'create'
                    ? 'text-white'
                    : ''
                }`}
                style={mode === 'create' ? { backgroundColor: 'rgb(22 101 52)' } : { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)', border: '1px solid' }}
              >
                Create Room
              </button>
              <button
                onClick={() => setMode('join')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold ${
                  mode === 'join'
                    ? 'text-white'
                    : ''
                }`}
                style={mode === 'join' ? { backgroundColor: 'rgb(22 101 52)' } : { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)', border: '1px solid' }}
              >
                Join Room
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
                {error}
              </div>
            )}

            {mode === 'create' ? (
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label htmlFor="poker-host-name" className="block mb-2" style={{ color: 'var(--ink-text)' }}>Your Name</label>
                  <input
                    id="poker-host-name"
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--ink-accent)]"
                    style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                    placeholder="Enter your name"
                    required
                    maxLength={20}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="poker-small-blind" className="block mb-2" style={{ color: 'var(--ink-text)' }}>Small Blind</label>
                    <input
                      id="poker-small-blind"
                      type="number"
                      value={smallBlind}
                      onChange={(e) => setSmallBlind(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--ink-accent)]"
                      style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="poker-big-blind" className="block mb-2" style={{ color: 'var(--ink-text)' }}>Big Blind</label>
                    <input
                      id="poker-big-blind"
                      type="number"
                      value={bigBlind}
                      onChange={(e) => setBigBlind(Math.max(smallBlind * 2, parseInt(e.target.value) || smallBlind * 2))}
                      className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--ink-accent)]"
                      style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                      min={smallBlind * 2}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="poker-timer" className="block mb-2" style={{ color: 'var(--ink-text)' }}>Timer (seconds)</label>
                    <input
                      id="poker-timer"
                      type="number"
                      value={timerPerTurn}
                      onChange={(e) => setTimerPerTurn(Math.max(5, Math.min(300, parseInt(e.target.value) || 40)))}
                      className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-[var(--ink-accent)]"
                      style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                      min="5"
                      max="300"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !hostName.trim()}
                  className="w-full text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'rgb(22 101 52)' }}
                >
                  {loading ? 'Creating...' : 'Create Room'}
                </button>
              </form>
            ) : showPositionSelection ? (
              <div>
                <div className="mb-4">
                  <button
                    onClick={() => setShowPositionSelection(false)}
                    className="mb-2 hover:opacity-80"
                    style={{ color: 'var(--ink-accent)' }}
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
                  <label className="block mb-2" style={{ color: 'var(--ink-text)' }}>Room PIN</label>
                  <input
                    type="text"
                    value={joinPin}
                    onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full rounded-lg px-4 py-2 border text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--ink-accent)]"
                    style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                    placeholder="0000"
                    maxLength={4}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!joinPin || joinPin.length !== 4}
                  className="w-full text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'rgb(22 101 52)' }}
                >
                  Continue to Select Seat
                </button>
              </form>
            )}
          </div>

        <div className="mt-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          <p>Use physical cards, track chips digitally</p>
          <p className="mt-2">Share the room PIN with friends to play together</p>
        </div>
      </div>
    </div>
  )
}

