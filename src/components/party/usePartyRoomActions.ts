'use client'

import { useCallback } from 'react'
import { partyFetch } from '@/lib/party/constants'

type RoomAction = 'start' | 'play-again'

/** Host actions on `/api/party/rooms/[pin]` shared by Quip Clash, Fib It, Enough About You. */
export function usePartyRoomActions(
  pin: string | null | undefined,
  playerId: string | null,
  loadOnce: (p: string) => Promise<void>,
  setError: (msg: string | null) => void,
) {
  const postRoomAction = useCallback(
    async (action: RoomAction, failLabel: string) => {
      if (!pin || !playerId) return
      const res = await partyFetch(`/api/party/rooms/${pin}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, playerId }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || failLabel)
      await loadOnce(pin)
    },
    [pin, playerId, loadOnce, setError],
  )

  return {
    startGame: useCallback(() => postRoomAction('start', 'Start failed'), [postRoomAction]),
    playAgain: useCallback(() => postRoomAction('play-again', 'Play again failed'), [postRoomAction]),
  }
}
