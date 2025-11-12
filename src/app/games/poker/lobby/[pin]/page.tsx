'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PokerLobby from '@/components/PokerLobby'

export default function PokerLobbyPage({ params }: { params: Promise<{ pin: string }> }) {
  const router = useRouter()
  const [pin, setPin] = useState<string>('')

  useEffect(() => {
    params.then((p) => setPin(p.pin))
  }, [params])

  if (!pin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  const handleBack = () => {
    // Clear session storage when leaving
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('poker_hostId')
      sessionStorage.removeItem('poker_playerId')
      sessionStorage.removeItem('poker_playerName')
    }
    router.push('/games/poker')
  }

  return (
    <PokerLobby
      pin={pin}
      onStartGame={() => router.push(`/games/poker/table/${pin}`)}
      onBack={handleBack}
    />
  )
}

