'use client'

import { useState, useEffect } from 'react'

interface PokerJoinFormProps {
  pin: string
  onJoin: (playerName: string, position: number) => Promise<void>
  onCancel: () => void
  loading: boolean
  error: string
}

export default function PokerJoinForm({ pin, onJoin, onCancel, loading, error }: PokerJoinFormProps) {
  const [playerName, setPlayerName] = useState('')
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null)
  const [occupiedPositions, setOccupiedPositions] = useState<Set<number>>(new Set())

  const loadAvailablePositions = async () => {
    try {
      const response = await fetch(`/api/poker/rooms/${pin}`)
      const data = await response.json()

      if (response.ok && data.players) {
        const occupied = new Set<number>(data.players.map((p: { position: number }) => p.position))
        setOccupiedPositions(occupied)
        
        // Auto-select first available position
        if (selectedPosition === null) {
          for (let i = 0; i < 12; i++) {
            if (!occupied.has(i)) {
              setSelectedPosition(i)
              break
            }
          }
        }
      }
    } catch {
      // Silently fail - positions will be auto-selected
    }
  }

  useEffect(() => {
    if (pin) {
      loadAvailablePositions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedPosition !== null && playerName.trim()) {
      await onJoin(playerName.trim(), selectedPosition)
    }
  }

  const getPositionLabel = (pos: number) => {
    return `Seat ${pos + 1}`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-white mb-2">Your Name</label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Enter your name"
          required
          maxLength={20}
        />
      </div>

      <div>
        <label className="block text-white mb-2">Choose Your Seat (Position)</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {Array.from({ length: 12 }, (_, i) => {
            const isOccupied = occupiedPositions.has(i)
            const isSelected = selectedPosition === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => !isOccupied && setSelectedPosition(i)}
                disabled={isOccupied}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isOccupied
                    ? 'bg-gray-800/50 border-gray-600 text-gray-500 cursor-not-allowed'
                    : isSelected
                    ? 'bg-green-600 border-green-400 text-white'
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
              >
                <div className="text-sm font-semibold">{getPositionLabel(i)}</div>
                {isOccupied && <div className="text-xs mt-1">Taken</div>}
              </button>
            )
          })}
        </div>
        {selectedPosition !== null && (
          <p className="text-gray-300 text-sm mt-2">
            Selected: {getPositionLabel(selectedPosition)} (Position {selectedPosition})
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !playerName.trim() || selectedPosition === null}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    </form>
  )
}

