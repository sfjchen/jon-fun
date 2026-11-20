'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidBuzzerPin } from '@/lib/jeopardy-buzzer'

const surface = {
  backgroundColor: 'var(--ink-paper)',
  borderColor: 'var(--ink-border)',
  color: 'var(--ink-text)',
} as const

export default function BuzzerLandingPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const join = useCallback(async () => {
    setError(null)
    const candidate = pin.trim()
    if (!isValidBuzzerPin(candidate)) {
      setError('Enter the 4-digit PIN shown on the host screen')
      return
    }
    setLoading(true)
    try {
      // Resolve to verify the PIN exists before pushing — better UX than dumping into a broken page.
      const res = await fetch(`/api/jeopardy/buzzer/sessions/${candidate}`, { cache: 'no-store' })
      if (res.status === 404) {
        setError('No buzzer session for that PIN. Ask the host to enable Buzzer Mode.')
        return
      }
      if (!res.ok) {
        setError('Could not reach server, try again.')
        return
      }
      router.push(`/games/jeopardy/buzz/${candidate}`)
    } catch {
      setError('Network error, try again.')
    } finally {
      setLoading(false)
    }
  }, [pin, router])

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border p-6 shadow-sm" style={surface}>
        <h1 className="mb-1 text-center font-lora text-3xl font-bold" style={{ color: 'var(--ink-text)' }}>
          Buzzer
        </h1>
        <p className="mb-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Enter the 4-digit PIN from the host screen.
        </p>

        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void join()
          }}
          placeholder="1234"
          className="mb-3 w-full rounded-lg border py-4 text-center font-bold tracking-[0.5em] tabular-nums outline-none"
          style={{
            fontSize: '2.5rem',
            backgroundColor: 'var(--ink-bg)',
            borderColor: 'var(--ink-border)',
            color: 'var(--ink-text)',
          }}
          autoFocus
        />

        {error && (
          <div className="mb-3 rounded-md px-3 py-2 text-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
            {error}
          </div>
        )}

        <button
          onClick={() => void join()}
          disabled={loading || pin.length < 4}
          className="w-full rounded-lg py-3 font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--ink-accent)' }}
        >
          {loading ? 'Joining...' : 'Join'}
        </button>
      </div>
    </div>
  )
}
