'use client'

/**
 * Renders the Triples page: title, rules panel and a Solo / With friends switch.
 */

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import PlayerName from '@/components/PlayerName'
import { HomeLink } from '@/components/HomeLink'
import { Info } from '@/components/daily/DayNav'
import TriplesSolo from '@/components/triples/TriplesSolo'
import TriplesRoomPlay from '@/components/triples/TriplesRoom'

/**
 * Opens on With friends when the link carries a room PIN, otherwise on Solo.
 */
export default function Triples({ initialPin }: { initialPin: string }) {
  const [chosenMode, setMode] = useState<'solo' | 'friends' | null>(initialPin ? 'friends' : null)
  const savedMode = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return sessionStorage.getItem('triples_session') ? 'friends' : 'solo'
      } catch {
        return 'solo'
      }
    },
    () => 'solo',
  )
  const mode = chosenMode ?? savedMode
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 select-none" style={{ touchAction: 'manipulation' }}>
      <header className="flex items-center gap-1 border-b pb-2" style={{ borderColor: 'var(--ink-border)' }}>
        <HomeLink className="h-10 w-10 justify-center" />
        <h1 className="mr-auto font-lora text-xl font-bold md:text-2xl">SET · full deck</h1>
        <Info>
          <ul className="list-disc space-y-1 pl-4">
            <li>Each card has 4 features: count (1-3), shape, color and fill.</li>
            <li>
              Find 3 cards where <strong>each feature</strong> is either all the same or all different.
            </li>
            <li>Example: 1, 2 and 3 shapes, all ovals, all green, 3 different fills.</li>
            <li>Not a triple: 2 cards share a feature and the 3rd differs.</li>
            <li>When no triple is showing, 3 more cards are dealt.</li>
            <li>With friends: everyone shares 1 board. A right claim is +1, a wrong one −1.</li>
          </ul>
        </Info>
      </header>
      <div className="flex items-center justify-between text-sm">
        <Link href="/games/set">← Daily puzzle</Link>
        <PlayerName />
      </div>
      <div
        className="mx-auto flex w-fit rounded-full border p-0.5 text-sm"
        role="tablist"
        style={{ borderColor: 'var(--ink-border)' }}
      >
        {(['solo', 'friends'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className="rounded-full px-4 py-1.5"
            style={mode === m ? { backgroundColor: 'var(--ink-text)', color: 'var(--ink-bg)' } : undefined}
          >
            {m === 'solo' ? 'Solo' : 'With friends'}
          </button>
        ))}
      </div>
      {mode === 'solo' ? <TriplesSolo /> : <TriplesRoomPlay initialPin={initialPin} />}
    </div>
  )
}
