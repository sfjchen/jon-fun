'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import ChwaziGame from '@/components/ChwaziGame'

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export default function ChwaziPage() {
  const pathname = usePathname()
  const linePaper = pathname?.startsWith('/notebook')
  const [touchOk, setTouchOk] = useState<boolean | null>(null)

  useEffect(() => {
    setTouchOk(isTouchDevice())
  }, [])

  if (touchOk === null) return null
  if (!touchOk) {
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <div className={`rounded-lg p-8 border max-w-md text-center shadow-sm ${linePaper ? 'notebook-line-paper' : ''}`} style={linePaper ? { borderColor: 'var(--ink-border)' } : { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
          <Image src="/doodles/chwazi.svg" alt="" width={64} height={64} className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-lora mb-4" style={{ color: 'var(--ink-text)' }}>Chwazi Finger Chooser</h1>
          <p className="mb-6" style={{ color: 'var(--ink-muted)' }}>
            This game is only available on touchscreen devices. Please use a phone, tablet, or other touch-enabled device.
          </p>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            Use ← Home above to return.
          </p>
        </div>
      </div>
    )
  }
  return <ChwaziGame />
}
