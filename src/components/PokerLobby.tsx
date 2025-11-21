'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Player {
  id: string
  player_id: string
  name: string
  chips: number
  position: number
  is_active: boolean
}

interface Room {
  id: string
  pin: string
  host_id: string
  small_blind: number
  big_blind: number
  status: string
  created_at: string
}

interface PokerLobbyProps {
  pin: string
  onStartGame: () => void
  onBack: () => void
}

export default function PokerLobby({ pin, onStartGame, onBack }: PokerLobbyProps) {
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const hostId = typeof window !== 'undefined' ? sessionStorage.getItem('poker_hostId') : null
  const isHost = hostId && room?.host_id === hostId

  useEffect(() => {
    loadRoomData()

    // Subscribe to room changes
    const roomSubscription = supabase
      .channel(`room:${pin}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_rooms',
          filter: `pin=eq.${pin}`,
        },
        () => {
          loadRoomData()
        }
      )
      .subscribe()

    // Subscribe to player changes
    const playerSubscription = supabase
      .channel(`players:${pin}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_players',
          filter: `room_pin=eq.${pin}`,
        },
        () => {
          loadRoomData()
        }
      )
      .subscribe()

    return () => {
      roomSubscription.unsubscribe()
      playerSubscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const loadRoomData = async () => {
    try {
      const response = await fetch(`/api/poker/rooms/${pin}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load room')
      }

      setRoom(data.room)
      setPlayers(data.players || [])
      setLoading(false)

      // If game started, redirect to table
      if (data.room.status === 'active') {
        onStartGame()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room')
      setLoading(false)
    }
  }

  const handleStartGame = async () => {
    if (!isHost) return

    setStarting(true)
    setError('')

    try {
      const response = await fetch(`/api/poker/rooms/${pin}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          hostId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start game')
      }

      onStartGame()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
      setStarting(false)
    }
  }

  const handleCopyPin = () => {
    navigator.clipboard.writeText(pin)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (error && !room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">
          <div className="text-red-400 mb-4">{error}</div>
          <button
            onClick={onBack}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/20 text-white"
            >
              ← Back
            </button>
            <div className="text-white text-sm">
              {isHost && <span className="bg-green-600 px-3 py-1 rounded-full">Host</span>}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 mb-6">
            <div className="text-center mb-6">
              <h1 className="text-4xl font-bold text-white mb-2">Room PIN</h1>
              <div className="flex items-center justify-center gap-4">
                <div className="text-6xl font-bold text-green-400 tracking-widest">{pin}</div>
                <button
                  onClick={handleCopyPin}
                  className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/20 text-white text-sm"
                >
                  Copy
                </button>
              </div>
              <p className="text-gray-300 mt-4">Share this PIN with friends to join</p>
            </div>

            {room && (
              <div className="grid grid-cols-2 gap-4 text-center mb-6">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-gray-400 text-sm">Small Blind</div>
                  <div className="text-2xl font-bold text-white">${room.small_blind}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-gray-400 text-sm">Big Blind</div>
                  <div className="text-2xl font-bold text-white">${room.big_blind}</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Players ({players.length}/12)</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            {players.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No players yet</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`bg-white/5 rounded-lg p-4 border ${
                      player.player_id === hostId
                        ? 'border-green-500'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-white font-semibold">{player.name}</div>
                      {player.player_id === hostId && (
                        <span className="text-xs bg-green-600 px-2 py-1 rounded">Host</span>
                      )}
                    </div>
                    <div className="text-gray-400 text-sm mt-1">Seat {player.position + 1} (Position {player.position})</div>
                  </div>
                ))}
              </div>
            )}

            {isHost && (
              <div className="mt-6">
                <button
                  onClick={handleStartGame}
                  disabled={starting || players.length < 2}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {starting
                    ? 'Starting...'
                    : players.length < 2
                      ? 'Need at least 2 players'
                      : 'Start Game'}
                </button>
              </div>
            )}

            {!isHost && (
              <div className="mt-6 text-center text-gray-400">
                Waiting for host to start the game...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

