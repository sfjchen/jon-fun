'use client'

/**
 * Renders the end-of-game card under the finished board: a short verdict, the guess grid and share/next actions.
 */

import Link from 'next/link'
import { useState } from 'react'

export type ConnectionsResultProps = {
  title: string
  won: boolean
  wrongGuesses: number
  shareLines: string[]
  basePath: string
  /** Shows a Play again button when set. */
  onReplay?: () => void
  /** Links to the leaderboard instead of the puzzle library. */
  daily?: boolean
}

const VERDICT = ['Perfect!', 'Great!', 'Solid!', 'Phew!']

/**
 * Renders the result card and shares through the phone share sheet, or copies on desktop.
 */
export default function ConnectionsResult({
  title,
  won,
  wrongGuesses,
  shareLines,
  basePath,
  onReplay,
  daily,
}: ConnectionsResultProps) {
  const [copied, setCopied] = useState(false)
  const text = [`Connections · ${title}`, ...shareLines].join('\n')
  const share = async () => {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) return navigator.share({ text }).catch(() => {})
    await navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => {},
    )
  }
  const btn = 'rounded-full border px-5 py-2.5 text-sm font-semibold'

  return (
    <div className="mx-auto w-full max-w-sm space-y-3 text-center" data-testid="connections-result">
      <h2 className="font-lora text-2xl font-semibold">{won ? VERDICT[wrongGuesses] : 'Next time!'}</h2>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        {won ? `Solved with ${wrongGuesses} mistake${wrongGuesses === 1 ? '' : 's'}` : 'Out of mistakes'}
      </p>
      <p className="font-mono text-xl leading-6 whitespace-pre" aria-label="Your guesses">
        {shareLines.join('\n')}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          data-hotkey="s"
          onClick={share}
          className={btn}
          style={{ backgroundColor: 'var(--ink-text)', borderColor: 'var(--ink-text)', color: 'var(--ink-bg)' }}
        >
          {copied ? 'Copied' : 'Share'}
        </button>
        {onReplay && (
          <button type="button" onClick={onReplay} className={btn} style={{ borderColor: 'currentColor' }}>
            Play again
          </button>
        )}
        <Link href={daily ? '/leaderboards' : basePath} className={btn} style={{ borderColor: 'currentColor' }}>
          {daily ? 'Leaderboard' : 'Library'}
        </Link>
      </div>
    </div>
  )
}
