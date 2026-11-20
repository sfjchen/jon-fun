'use client'

import { useCallback, useEffect, useState } from 'react'
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
  timer_per_turn?: number
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
  const [timerPerTurn, setTimerPerTurn] = useState(40)
  const [updatingTimer, setUpdatingTimer] = useState(false)
  const [adjustingPlayer, setAdjustingPlayer] = useState<string | null>(null)
  const hostId = typeof window !== 'undefined' ? sessionStorage.getItem('poker_hostId') : null
  const isHost = hostId && room?.host_id === hostId

  const loadRoomData = useCallback(() => {
    return fetch(`/api/poker/rooms/${pin}`)
      .then(async (response) => {
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load room')
        }

        setRoom(data.room)
        if (data.room?.timer_per_turn) setTimerPerTurn(data.room.timer_per_turn)
        setPlayers(data.players || [])
        setLoading(false)

        if (data.room.status === 'active') {
          onStartGame()
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load room')
        setLoading(false)
      })
  }, [pin, onStartGame])

  useEffect(() => {
    loadRoomData()

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
        },
      )
      .subscribe()

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
        },
      )
      .subscribe()

    return () => {
      roomSubscription.unsubscribe()
      playerSubscription.unsubscribe()
    }
  }, [pin, loadRoomData])

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

  const handleAdjustChips = async (targetPlayerId: string, chips: number) => {
    if (!isHost || !room) return
    setAdjustingPlayer(targetPlayerId)
    setError('')
    try {
      const response = await fetch(`/api/poker/rooms/${pin}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_chips',
          hostId,
          targetPlayerId,
          chips,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to adjust chips')
      loadRoomData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust chips')
    } finally {
      setAdjustingPlayer(null)
    }
  }

  const handleCopyPin = () => {
    navigator.clipboard.writeText(pin)
  }

  const handleUpdateTimer = async () => {
    if (!isHost || !room) return

    setUpdatingTimer(true)
    setError('')

    try {
      const response = await fetch(`/api/poker/rooms/${pin}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timer_per_turn: timerPerTurn,
          hostId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update timer')
      }

      // Reload room data
      loadRoomData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update timer')
    } finally {
      setUpdatingTimer(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    )
  }

  if (error && !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-8 text-center backdrop-blur-sm">
          <div className="mb-4 text-red-400">{error}</div>
          <button onClick={onBack} className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={onBack}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
            >
              ← Back
            </button>
            <div className="text-sm text-white">
              {isHost && <span className="rounded-full bg-green-600 px-3 py-1">Host</span>}
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm">
            <div className="mb-6 text-center">
              <h1 className="mb-2 text-4xl font-bold text-white">Room PIN</h1>
              <div className="flex items-center justify-center gap-4">
                <div className="text-6xl font-bold tracking-widest text-green-400">{pin}</div>
                <button
                  onClick={handleCopyPin}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                >
                  Copy
                </button>
              </div>
              <p className="mt-4 text-gray-300">Share this PIN with friends to join</p>
            </div>

            {room && (
              <div className="mb-6 grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="text-sm text-gray-400">Small Blind</div>
                  <div className="text-2xl font-bold text-white">${room.small_blind}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="text-sm text-gray-400">Big Blind</div>
                  <div className="text-2xl font-bold text-white">${room.big_blind}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="text-sm text-gray-400">Timer (seconds)</div>
                  {isHost ? (
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <input
                        type="number"
                        value={timerPerTurn}
                        onChange={(e) => setTimerPerTurn(Math.max(5, Math.min(300, parseInt(e.target.value) || 40)))}
                        className="w-16 rounded border border-white/20 bg-white/10 px-2 py-1 text-center text-lg text-white"
                        min="5"
                        max="300"
                      />
                      <button
                        onClick={handleUpdateTimer}
                        disabled={updatingTimer}
                        className="min-h-11 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:bg-gray-600"
                      >
                        {updatingTimer ? '...' : 'Update'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-white">{room.timer_per_turn || 40}s</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm">
            <h2 className="mb-4 text-2xl font-bold text-white">Players ({players.length}/12)</h2>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/20 p-3 text-red-200">{error}</div>
            )}

            {players.length === 0 ? (
              <div className="py-8 text-center text-gray-400">No players yet</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`rounded-lg border bg-white/5 p-4 ${
                      player.player_id === hostId ? 'border-green-500' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white">{player.name}</div>
                      {player.player_id === hostId && (
                        <span className="rounded bg-green-600 px-2 py-1 text-xs">Host</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-400">Seat {player.position + 1}</div>
                    {isHost && room?.status === 'waiting' && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          defaultValue={player.chips || 1000}
                          min={0}
                          className="w-20 rounded border border-white/20 bg-white/10 px-2 py-1 text-sm text-white"
                          onBlur={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0)
                            if (val !== player.chips) handleAdjustChips(player.player_id, val)
                          }}
                        />
                        <span className="text-xs text-gray-500">
                          {adjustingPlayer === player.player_id ? 'Saving...' : 'Rebuy/set'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isHost && (
              <div className="mt-6">
                <button
                  onClick={handleStartGame}
                  disabled={starting || players.length < 2}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-600"
                >
                  {starting ? 'Starting...' : players.length < 2 ? 'Need at least 2 players' : 'Start Game'}
                </button>
              </div>
            )}

            {!isHost && <div className="mt-6 text-center text-gray-400">Waiting for host to start the game...</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
