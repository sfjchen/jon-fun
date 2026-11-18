'use client'

/**
 * Lays out the cards on the table, 3 across on phones and 4 on wider screens, and handles picking 3.
 */

import TriplesCard, { StripeDefs } from '@/components/triples/TriplesCard'

type Props = {
  board: number[]
  selected: number[]
  hinted?: number[]
  shake?: boolean
  disabled?: boolean
  onPick: (card: number) => void
}

/**
 * Renders the grid. Shake applies to the selected cards after a miss.
 */
export default function TriplesBoard({ board, selected, hinted = [], shake, disabled, onPick }: Props) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <StripeDefs />
      <style>{`@keyframes tp-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`}</style>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {board.map((card) => (
          <TriplesCard
            key={card}
            card={card}
            selected={selected.includes(card)}
            hinted={hinted.includes(card)}
            shake={Boolean(shake && selected.includes(card))}
            disabled={disabled ?? false}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  )
}
