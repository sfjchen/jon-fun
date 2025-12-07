'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'idle' | 'primed' | 'selecting' | 'winner'

interface TouchPoint {
  id: number
  x: number
  y: number
  color: string
}

const CHWAZI_COLORS = [
  '#ff5252',
  '#ffb300',
  '#7c4dff',
  '#1de9b6',
  '#40c4ff',
  '#ff4081',
  '#aeea00',
  '#ff6e40',
]

const PRIME_DELAY_MS = 650
const SELECT_DELAY_MS = 950

export default function ChwaziGame() {
  const [touches, setTouches] = useState<Map<number, TouchPoint>>(new Map())
  const [status, setStatus] = useState<Status>('idle')
  const [winnerId, setWinnerId] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const touchesRef = useRef<Map<number, TouchPoint>>(new Map())
  const statusRef = useRef<Status>('idle')
  const primeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const rafRef = useRef<number | null>(null)

  const setStatusSafe = (next: Status) => {
    statusRef.current = next
    setStatus(next)
  }

  const clearTimers = () => {
    if (primeTimerRef.current) clearTimeout(primeTimerRef.current)
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
    primeTimerRef.current = null
    selectionTimerRef.current = null
  }

  const scheduleCommitTouches = () => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      setTouches(new Map(touchesRef.current))
      rafRef.current = null
    })
  }

  const pickColor = (currentTouches: Map<number, TouchPoint>): string => {
    const usedColors = new Set(Array.from(currentTouches.values()).map((touch) => touch.color))
    const available = CHWAZI_COLORS.filter((color) => !usedColors.has(color))
    const palette = available.length > 0 ? available : CHWAZI_COLORS
    const color = palette[Math.floor(Math.random() * palette.length)] ?? CHWAZI_COLORS[0]
    return color ?? '#ff5252'
  }

  const startSelectionCountdown = useCallback(() => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
    selectionTimerRef.current = setTimeout(() => {
      const ids = Array.from(touchesRef.current.keys())
      if (ids.length < 2) return
      const randomWinner = ids[Math.floor(Math.random() * ids.length)]
      setWinnerId(randomWinner ?? null)
      setStatusSafe('winner')
    }, SELECT_DELAY_MS)
  }, [])

  const startPrimeCountdown = useCallback(() => {
    if (primeTimerRef.current) clearTimeout(primeTimerRef.current)
    primeTimerRef.current = setTimeout(() => {
      if (touchesRef.current.size < 2) return
      setStatusSafe('selecting')
      startSelectionCountdown()
    }, PRIME_DELAY_MS)
  }, [startSelectionCountdown])

  const evaluateState = useCallback(() => {
    const fingerCount = touchesRef.current.size

    if (fingerCount < 2) {
      clearTimers()
      if (statusRef.current !== 'idle') {
        setStatusSafe('idle')
      }
      setWinnerId(null)
      return
    }

    if (statusRef.current === 'winner') {
      setWinnerId(null)
      setStatusSafe('primed')
    }

    if (statusRef.current === 'idle' || statusRef.current === 'primed') {
      startPrimeCountdown()
      return
    }

    if (statusRef.current === 'selecting') {
      startSelectionCountdown()
    }
  }, [startPrimeCountdown, startSelectionCountdown])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const updated = new Map(touchesRef.current)

      if (statusRef.current === 'winner') {
        setStatusSafe('idle')
        setWinnerId(null)
      }

      Array.from(e.changedTouches).forEach((touch) => {
        updated.set(touch.identifier, {
          id: touch.identifier,
          x: touch.clientX,
          y: touch.clientY,
          color: pickColor(updated),
        })
      })

      touchesRef.current = updated
      scheduleCommitTouches()
      evaluateState()
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const updated = new Map(touchesRef.current)

      Array.from(e.changedTouches).forEach((touch) => {
        if (!updated.has(touch.identifier)) return
        const existing = updated.get(touch.identifier)!
        updated.set(touch.identifier, { ...existing, x: touch.clientX, y: touch.clientY })
      })

      touchesRef.current = updated
      scheduleCommitTouches()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      const updated = new Map(touchesRef.current)

      Array.from(e.changedTouches).forEach((touch) => {
        updated.delete(touch.identifier)
      })

      touchesRef.current = updated
      scheduleCommitTouches()
      evaluateState()
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: false })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
      clearTimers()
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [evaluateState])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-[#05070f] text-white touch-none select-none overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(64,196,255,0.08),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(255,64,129,0.12),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(29,233,182,0.12),transparent_35%)]" />

      <div className="relative h-full w-full">
        <div className="absolute top-6 w-full flex justify-center">
          <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-sm font-medium tracking-wide text-gray-100">
            {status === 'selecting'
              ? 'Selecting…'
              : status === 'winner'
                ? 'Winner chosen'
                : 'Place and hold your fingers'}
          </div>
        </div>

        {touches.size === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-xl font-semibold tracking-wide animate-pulse">
              Place your fingers on the screen
            </p>
          </div>
        )}

        {Array.from(touches.values()).map((touch) => {
          const isWinner = winnerId === touch.id && status === 'winner'
          const dimmed = status === 'winner' && !isWinner
          const isSelecting = status === 'selecting'
          const size = 96

          return (
            <div
              key={touch.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out ${isWinner ? 'scale-150' : isSelecting ? 'scale-110' : 'scale-100'} ${dimmed ? 'opacity-30' : 'opacity-90'}`}
              style={{
                left: touch.x,
                top: touch.y,
                width: size,
                height: size,
              }}
            >
              <div
                className={`absolute inset-0 rounded-full ${isSelecting || isWinner ? 'animate-ping' : ''}`}
                style={{
                  backgroundColor: `${touch.color}33`,
                  boxShadow: `0 0 40px ${touch.color}55`,
                }}
              />

              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle at 30% 30%, #ffffff, ${touch.color})`,
                  boxShadow: `0 10px 35px ${touch.color}aa, inset 0 0 14px #ffffff22`,
                  border: `4px solid ${isWinner ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}`,
                }}
              />

              <div className="absolute inset-2 rounded-full border-2 border-white/30" />

              {isWinner && (
                <div
                  className="absolute inset-[-16px] rounded-full animate-ping"
                  style={{ backgroundColor: `${touch.color}33` }}
                />
              )}
            </div>
          )
        })}

        {status === 'winner' && winnerId !== null && (
          <div className="absolute bottom-10 w-full flex justify-center pointer-events-none">
            <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm backdrop-blur-sm">
              Chwazi picked the highlighted finger
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
