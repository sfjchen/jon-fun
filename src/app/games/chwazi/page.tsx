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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Chwazi Finger Chooser</h1>
          <p className="text-gray-300 mb-6">
            This game is only available on touchscreen devices. Please use a phone, tablet, or other touch-enabled device.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            ← Home
          </Link>
        </div>
      </div>
    )
  }
  return <ChwaziGame />
}
