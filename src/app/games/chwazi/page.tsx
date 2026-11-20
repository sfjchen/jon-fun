'use client'

import Image from 'next/image'
import { useSyncExternalStore } from 'react'
import ChwaziGame from '@/components/ChwaziGame'

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export default function ChwaziPage() {
  const touchOk = useSyncExternalStore<boolean | null>(
    () => () => {},
    isTouchDevice,
    () => null,
  )

  if (touchOk === null) return null
  if (!touchOk) {
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <div
          className="max-w-md rounded-lg border p-8 text-center shadow-sm"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <Image src="/doodles/notebook/chwazi.svg" alt="" width={64} height={64} className="mx-auto mb-4 h-16 w-16" />
          <h1 className="mb-4 font-lora text-2xl font-bold" style={{ color: 'var(--ink-text)' }}>
            Chwazi Finger Chooser
          </h1>
          <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
            This game is only available on touchscreen devices. Please use a phone, tablet, or other touch-enabled
            device.
          </p>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            Use the home link above to return.
          </p>
        </div>
      </div>
    )
  }
  return <ChwaziGame />
}
