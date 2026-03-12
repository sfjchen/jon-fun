'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ChwaziGame from '@/components/ChwaziGame'

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export default function ChwaziPage() {
  const [touchOk, setTouchOk] = useState<boolean | null>(null)

  useEffect(() => {
    setTouchOk(isTouchDevice())
  }, [])

  if (touchOk === null) return null
  if (!touchOk) {
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <div className="rounded-lg p-8 border max-w-md text-center shadow-sm" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
          <h1 className="text-2xl font-bold font-lora mb-4" style={{ color: 'var(--ink-text)' }}>Chwazi Finger Chooser</h1>
          <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
            This game is only available on touchscreen devices. Please use a phone, tablet, or other touch-enabled device.
          </p>
          <Link
            href="/"
            className="inline-block text-white px-6 py-2 rounded-lg hover:opacity-90"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            ← Home
          </Link>
        </div>
      </div>
    )
  }
  return <ChwaziGame />
}
