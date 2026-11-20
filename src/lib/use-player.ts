'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { getPlayer, PLAYER_CHANGED, type Player } from '@/lib/results'

/**
 * Subscribes to changes of the saved player, made in this tab or another one.
 */
function subscribe(cb: () => void) {
  window.addEventListener(PLAYER_CHANGED, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(PLAYER_CHANGED, cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * Returns the name and group saved on this device, or null before one is set, and follows later edits.
 */
export function usePlayer(): Player | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(getPlayer()),
    () => 'null',
  )
  return useMemo(() => JSON.parse(raw) as Player | null, [raw])
}
