'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BuzzerPlayer from '@/components/BuzzerPlayer'
import { isValidBuzzerPin, type Buzz, type BuzzerSession } from '@/lib/jeopardy-buzzer'

export default function BuzzerPlayerPage() {
  const router = useRouter()
  const params = useParams<{ pin: string }>()
  const pin = params?.pin || ''
  const [data, setData] = useState<{ session: BuzzerSession; queue: Buzz[]; boardTitle: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isValidBuzzerPin(pin)) {
      setError('Invalid PIN')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/jeopardy/buzzer/sessions/${pin}`, { cache: 'no-store' })
        if (res.status === 404) {
          if (!cancelled) setError('No buzzer session for that PIN.')
          return
        }
        if (!res.ok) throw new Error(await res.text())
        const d = await res.json() as { session: BuzzerSession; queue: Buzz[]; board?: { title?: string | null } | null }
        if (!cancelled) setData({ session: d.session, queue: d.queue ?? [], boardTitle: d.board?.title ?? null })
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load buzzer session.')
      }
    })()
    return () => { cancelled = true }
  }, [pin])

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 text-center">
        <div>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--ink-text)' }}>{error}</h2>
          <button onClick={() => router.push('/games/jeopardy/buzz')}
            className="px-4 py-2 rounded-lg border"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
            Try another PIN
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 text-center"
        style={{ color: 'var(--ink-muted)' }}>
        Connecting...
      </div>
    )
  }

  return (
    <BuzzerPlayer pin={pin} initialSession={data.session} initialQueue={data.queue} boardTitle={data.boardTitle} />
  )
}
