'use client'

/** Shared disclosure for the additional daily games. */

import { useState, type ReactNode } from 'react'
import { CORE_IDS, GAME_IDS, GAMES, type GameId } from '@/lib/results'

/** Renders core games first and reveals the rest on demand or when an extra game is selected. */
export default function TierGroups({
  selected = 'all',
  onClear,
  children,
}: {
  selected?: GameId | 'all' | undefined
  onClear?: (() => void) | undefined
  children: (games: GameId[]) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const extraSelected = selected !== 'all' && GAMES[selected].tier !== 1
  const expanded = open || extraSelected
  return (
    <>
      {children(expanded ? GAME_IDS : CORE_IDS)}
      {GAME_IDS.length > CORE_IDS.length && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => {
            setOpen(!expanded)
            if (extraSelected) onClear?.()
          }}
          className="mt-2 min-h-9 rounded-lg px-2 text-sm font-medium text-[var(--ink-accent)] underline-offset-4 hover:underline"
        >
          {expanded ? 'Fewer games' : 'More games'}
        </button>
      )}
    </>
  )
}
