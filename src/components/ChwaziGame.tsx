'use client'

import { useEffect, useRef, useState } from 'react'

interface TouchPoint {
    id: number
    x: number
    y: number
    color: string
}

const COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEEAD', // Yellow
    '#D4A5A5', // Pink
    '#9B59B6', // Purple
    '#3498DB', // Dark Blue
]

export default function ChwaziGame() {
    const [touches, setTouches] = useState<Map<number, TouchPoint>>(new Map())
    const [status, setStatus] = useState<'waiting' | 'selecting' | 'winner'>('waiting')
    const [winnerId, setWinnerId] = useState<number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const touchesRef = useRef<Map<number, TouchPoint>>(new Map())

    // Handle touch events
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault()
            setTouches(prev => {
                const newTouches = new Map(prev)

                // Reset if game over and new touch detected
                if (status === 'winner') {
                    setStatus('waiting')
                    setWinnerId(null)
                    newTouches.clear()
                }

                Array.from(e.changedTouches).forEach((touch) => {
                    const usedColors = new Set(Array.from(newTouches.values()).map(t => t.color))
                    const availableColors = COLORS.filter(c => !usedColors.has(c))
                    const color = (availableColors.length > 0
                        ? availableColors[Math.floor(Math.random() * availableColors.length)]
                        : COLORS[Math.floor(Math.random() * COLORS.length)]) ?? '#FF6B6B'

                    newTouches.set(touch.identifier, {
                        id: touch.identifier,
                        x: touch.clientX,
                        y: touch.clientY,
                        color
                    })
                })
                touchesRef.current = newTouches
                return newTouches
            })
        }

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault()
            setTouches(prev => {
                const newTouches = new Map(prev)
                Array.from(e.changedTouches).forEach((touch) => {
                    if (newTouches.has(touch.identifier)) {
                        const existing = newTouches.get(touch.identifier)!
                        newTouches.set(touch.identifier, { ...existing, x: touch.clientX, y: touch.clientY })
                    }
                })
                touchesRef.current = newTouches
                return newTouches
            })
        }

        const handleTouchEnd = (e: TouchEvent) => {
            e.preventDefault()
            setTouches(prev => {
                const newTouches = new Map(prev)
                Array.from(e.changedTouches).forEach((touch) => {
                    newTouches.delete(touch.identifier)
                })
                touchesRef.current = newTouches
                return newTouches
            })
        }

        // Add non-passive listeners to prevent scrolling
        container.addEventListener('touchstart', handleTouchStart, { passive: false })
        container.addEventListener('touchmove', handleTouchMove, { passive: false })
        container.addEventListener('touchend', handleTouchEnd, { passive: false })
        container.addEventListener('touchcancel', handleTouchEnd, { passive: false })

        return () => {
            container.removeEventListener('touchstart', handleTouchStart)
            container.removeEventListener('touchmove', handleTouchMove)
            container.removeEventListener('touchend', handleTouchEnd)
            container.removeEventListener('touchcancel', handleTouchEnd)
        }
    }, [status])

    // Game Logic
    useEffect(() => {
        // If we are in winner state, don't do anything until reset
        if (status === 'winner') return

        // If less than 2 fingers, cancel any selection
        if (touches.size < 2) {
            if (status === 'selecting') {
                setStatus('waiting')
                if (timerRef.current) clearTimeout(timerRef.current)
            }
            return
        }

        // If 2 or more fingers and waiting, start selecting
        if (status === 'waiting' && touches.size >= 2) {
            setStatus('selecting')

            // Wait 3 seconds then pick a winner
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                const touchIds = Array.from(touchesRef.current.keys())
                const randomWinner = touchIds[Math.floor(Math.random() * touchIds.length)]
                setWinnerId(randomWinner ?? null)
                setStatus('winner')
            }, 3000)
        }

        // If touches change during selection, we might want to reset timer?
        // For now, let's keep it simple: as long as >= 2 fingers, keep selecting.
        // If it drops < 2, we handled that above.

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [touches.size, status]) // Only re-run if count or status changes

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black touch-none select-none overflow-hidden"
        >
            {/* Instructions */}
            {touches.size === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-500 text-xl animate-pulse">Place fingers on screen</p>
                </div>
            )}

            {/* Touch Points */}
            {Array.from(touches.values()).map((touch) => {
                const isWinner = status === 'winner' && touch.id === winnerId
                const isLoser = status === 'winner' && touch.id !== winnerId

                return (
                    <div
                        key={touch.id}
                        className={`absolute rounded-full transition-all duration-300 ease-out transform -translate-x-1/2 -translate-y-1/2
              ${isWinner ? 'scale-150 z-10 ring-8 ring-white' : ''}
              ${isLoser ? 'opacity-20 scale-75' : 'opacity-80'}
              ${status === 'selecting' ? 'animate-pulse' : ''}
            `}
                        style={{
                            left: touch.x,
                            top: touch.y,
                            width: '100px',
                            height: '100px',
                            backgroundColor: touch.color,
                            boxShadow: `0 0 30px ${touch.color}`,
                        }}
                    >
                        {/* Inner ring for visual flair */}
                        <div className="absolute inset-2 rounded-full border-4 border-white/30" />
                    </div>
                )
            })}
        </div>
    )
}
