'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export type GameCardGame = {
  id: string
  title: string
  description: string
  icon: string
  href: string
  available: boolean
}

type GameCardProps = {
  game: GameCardGame
  onComingSoonClick: () => void
  linePaper?: boolean
  compact?: boolean
}

const cardBase =
  'block w-full rounded-lg text-left transition-all duration-[175ms] ease-out ' +
  'bg-[var(--ink-paper)] border border-[var(--ink-border)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ' +
  'hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2'

export function GameCard({ game, onComingSoonClick, linePaper, compact }: GameCardProps) {
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => setClientReady(true), [])
  const useCompact = compact ?? !linePaper
  const cardClass = cardBase + (linePaper ? ' bg-transparent h-full min-h-0 flex flex-col' : '') + (useCompact ? ' p-6' : ' p-[30px]')
  const content = (
    <>
      <div className={`flex h-16 items-center justify-center shrink-0 ${useCompact ? 'mb-4' : 'mb-[30px]'}`}>
        {game.icon.startsWith('/') ? (
          <Image src={game.icon} alt={game.title} width={64} height={64} className="h-14 w-14 sm:h-16 sm:w-16 object-contain drop-shadow-lg" priority />
        ) : (
          <span className="text-5xl leading-none">{game.icon}</span>
        )}
      </div>
      <h2 className={`font-lora text-xl font-semibold tracking-wide ${useCompact ? 'mb-2' : 'mb-[30px]'}`} style={{ color: 'var(--ink-text)' }}>
        {game.title}
      </h2>
      <p className={`text-sm flex-1 min-h-0 ${useCompact ? 'mb-4 line-clamp-2' : 'mb-[30px] line-clamp-3'}`} style={{ color: 'var(--ink-muted)' }}>
        {game.description}
      </p>
      <div className="text-sm" style={{ color: 'var(--ink-accent)' }}>
        {game.available ? 'Click to play →' : 'Click to see features →'}
      </div>
    </>
  )

  if (!game.available) {
    return (
      <button onClick={onComingSoonClick} disabled={!clientReady} className={`${cardClass} disabled:opacity-50`}>
        {content}
      </button>
    )
  }

  return (
    <Link href={game.href} className={cardClass}>
      {content}
    </Link>
  )
}
