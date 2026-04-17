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
}

const cardBase =
  'block w-full rounded-lg text-left transition-all duration-[175ms] ease-out ' +
  'bg-[var(--ink-paper)] border border-[var(--ink-border)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ' +
  'hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2'

function HomeTileContent({ game }: { game: GameCardGame }) {
  return (
    <>
      {/* Icons sit on the card surface (no inner tile) — matches pre–home-tile layout */}
      <div className="mb-3 flex h-14 shrink-0 items-center justify-center sm:h-16">
        {game.icon.startsWith('/') ? (
          <Image
            src={game.icon}
            alt=""
            width={56}
            height={56}
            className="h-12 w-12 object-contain drop-shadow-lg sm:h-14 sm:w-14"
            priority
          />
        ) : (
          <span className="select-none text-4xl leading-none sm:text-5xl" style={{ color: 'var(--ink-text)' }}>
            {game.icon}
          </span>
        )}
      </div>
      <div
        className="min-h-12 flex-1 text-center font-lora text-lg font-bold leading-snug sm:min-h-14 sm:text-xl sm:leading-snug line-clamp-2"
        style={{ color: 'var(--ink-text)' }}
      >
        {game.title}
      </div>
    </>
  )
}

export function GameCard({ game, onComingSoonClick, linePaper, compact, hideDescription }: GameCardProps) {
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => setClientReady(true), [])
  const useCompact = compact ?? !linePaper
  const homeTile = Boolean(hideDescription && useCompact && linePaper)

  const cardClass =
    cardBase +
    (linePaper ? ' bg-transparent min-h-0 flex flex-col' : '') +
    (homeTile
      ? ' h-full w-full min-h-[11rem] flex flex-col p-4 sm:min-h-[12rem] sm:p-5'
      : useCompact
        ? ' p-6'
        : ' p-[30px]')

  const homeTileVisual = (
    <span aria-hidden className="flex min-h-0 flex-1 flex-col">
      <HomeTileContent game={game} />
    </span>
  )

  const content = homeTile ? (
    homeTileVisual
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
      <button
        type="button"
        onClick={onComingSoonClick}
        disabled={!clientReady}
        className={`${cardClass} disabled:opacity-50${homeTile ? ' text-center' : ''}`}
        aria-label={homeTile ? 'Preview coming soon projects' : undefined}
      >
        {content}
      </button>
    )
  }

  return (
    <Link
      href={game.href}
      className={cardClass + (homeTile ? ' text-center' : '')}
      aria-label={homeTile ? `Open ${game.title}` : undefined}
    >
      {content}
    </Link>
  )
}
