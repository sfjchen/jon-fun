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
  /** Omit description line (e.g. home grid — copy lives on the game page). */
  hideDescription?: boolean
  className?: string
}

const cardBase =
  'block w-full rounded-lg text-left transition-all duration-[175ms] ease-out ' +
  'bg-[var(--ink-paper)] border border-[var(--ink-border)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ' +
  'hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2'

const ICON_BOX = 'flex size-[4.25rem] shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]'

function HomeTileContent({
  game,
  available,
}: {
  game: GameCardGame
  available: boolean
}) {
  return (
    <>
      <div className="mb-4 flex justify-center">
        <div
          className={ICON_BOX}
          style={{
            borderColor: 'var(--ink-border)',
            backgroundColor: 'rgba(255,255,255,0.35)',
          }}
        >
          {game.icon.startsWith('/') ? (
            <Image
              src={game.icon}
              alt=""
              width={48}
              height={48}
              className="size-12 object-contain"
              priority
            />
          ) : (
            <span className="select-none text-[1.65rem] font-semibold leading-none tracking-tight" style={{ color: 'var(--ink-text)' }}>
              {game.icon}
            </span>
          )}
        </div>
      </div>
      <h2
        className="mb-1 min-h-11 flex-1 text-center font-lora text-[1.05rem] font-semibold leading-snug sm:text-[1.125rem] line-clamp-2"
        style={{ color: 'var(--ink-text)' }}
      >
        {game.title}
      </h2>
      <p className="text-center text-xs font-medium tabular-nums tracking-wide" style={{ color: 'var(--ink-accent)' }}>
        {available ? 'Open' : 'Preview'}
      </p>
    </>
  )
}

export function GameCard({ game, onComingSoonClick, linePaper, compact, hideDescription, className }: GameCardProps) {
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => setClientReady(true), [])
  const useCompact = compact ?? !linePaper
  const homeTile = Boolean(hideDescription && useCompact && linePaper)

  const cardClass =
    cardBase +
    (linePaper ? ' bg-transparent min-h-0 flex flex-col' : '') +
    (homeTile
      ? ' h-full w-full min-h-[12.5rem] flex flex-col p-5 sm:min-h-[13rem] sm:p-6'
      : useCompact
        ? ' p-6'
        : ' p-[30px]') +
    (className ? ` ${className}` : '')

  const content = homeTile ? (
    <HomeTileContent game={game} available={game.available} />
  ) : (
    <>
      <div className={`flex h-16 items-center justify-center shrink-0 ${useCompact ? 'mb-4' : 'mb-[30px]'}`}>
        {game.icon.startsWith('/') ? (
          <Image src={game.icon} alt={game.title} width={64} height={64} className="h-14 w-14 sm:h-16 sm:w-16 object-contain drop-shadow-lg" priority />
        ) : (
          <span className="text-5xl leading-none">{game.icon}</span>
        )}
      </div>
      <h2 className={`font-lora text-xl font-bold ${hideDescription ? (useCompact ? 'mb-4' : 'mb-[30px]') : useCompact ? 'mb-2' : 'mb-[30px]'}`} style={{ color: 'var(--ink-text)' }}>
        {game.title}
      </h2>
      {!hideDescription && (
        <p className={`text-sm flex-1 min-h-0 ${useCompact ? 'mb-4 line-clamp-2' : 'mb-[30px] line-clamp-3'}`} style={{ color: 'var(--ink-muted)' }}>
          {game.description}
        </p>
      )}
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
    <Link href={game.href} className={cardClass + (homeTile ? ' text-center' : '')}>
      {content}
    </Link>
  )
}
