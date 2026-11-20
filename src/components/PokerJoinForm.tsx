'use client'
import { useDeviceName } from '@/lib/use-device-name'
import { getDevicePlayer, saveDevicePlayer } from '@/lib/syncIdentity'

import { useState, useEffect } from 'react'

interface PokerJoinFormProps {
  pin: string
  onJoin: (playerName: string, position: number) => Promise<void>
  onCancel: () => void
  loading: boolean
  error: string
}

export default function PokerJoinForm({ pin, onJoin, onCancel, loading, error }: PokerJoinFormProps) {
  const [playerName, setPlayerName] = useDeviceName()
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null)
  const [occupiedPositions, setOccupiedPositions] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!pin) return
    void (async () => {
      try {
        const response = await fetch(`/api/poker/rooms/${pin}`)
        const data = await response.json()

        if (response.ok && data.players) {
          const occupied = new Set<number>(data.players.map((p: { position: number }) => p.position))
          setOccupiedPositions(occupied)

          // Auto-select first available position
          setSelectedPosition((prev) => {
            if (prev !== null) return prev
            for (let i = 0; i < 12; i++) if (!occupied.has(i)) return i
            return null
          })
        }
      } catch {
        // Silently fail - positions will be auto-selected
      }
    })()
  }, [pin])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedPosition !== null && playerName.trim()) {
      await onJoin(playerName.trim(), selectedPosition)
      saveDevicePlayer({ name: playerName, group: getDevicePlayer()?.group ?? 'public' })
    }
  }

  const getPositionLabel = (pos: number) => {
    return `Seat ${pos + 1}`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block" style={{ color: 'var(--ink-text)' }}>
          Your Name
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-[var(--ink-accent)] focus:outline-none"
          style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
          placeholder="Enter your name"
          required
          maxLength={20}
        />
      </div>

      <div>
        <label className="mb-2 block" style={{ color: 'var(--ink-text)' }}>
          Choose Your Seat (Position)
        </label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => {
            const isOccupied = occupiedPositions.has(i)
            const isSelected = selectedPosition === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => !isOccupied && setSelectedPosition(i)}
                disabled={isOccupied}
                className={`rounded-lg border-2 p-3 transition-all ${
                  isOccupied ? 'cursor-not-allowed opacity-50' : isSelected ? 'text-white' : ''
                }`}
                style={
                  isOccupied
                    ? { backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }
                    : isSelected
                      ? { backgroundColor: 'rgb(22 101 52)', borderColor: 'rgb(34 197 94)' }
                      : {
                          backgroundColor: 'var(--ink-paper)',
                          borderColor: 'var(--ink-border)',
                          color: 'var(--ink-text)',
                        }
                }
              >
                <div className="text-sm font-semibold">{getPositionLabel(i)}</div>
                {isOccupied && <div className="mt-1 text-xs">Taken</div>}
              </button>
            )
          })}
        </div>
        {selectedPosition !== null && (
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Selected: {getPositionLabel(selectedPosition)} (Position {selectedPosition})
          </p>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-500/50 bg-red-500/20 p-3 text-red-200">{error}</div>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border px-4 py-2 hover:opacity-90"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !playerName.trim() || selectedPosition === null}
          className="flex-1 rounded-lg px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: 'rgb(22 101 52)' }}
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    </form>
  )
}
