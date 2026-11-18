'use client'

/**
 * Loads one day's puzzle for a daily game and renders it under the shared header.
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DayNav from '@/components/daily/DayNav'
import MiniPlay, { type MiniPuzzle } from '@/components/mini/MiniPlay'
import ConnectionsPlay from '@/components/connections/ConnectionsPlay'
import { DAILY_EPOCH, siteDay, validDay } from '@/lib/daily'
import { GAMES, isPracticeResult, type GameId } from '@/lib/results'
import type { ConnectionsPuzzle } from '@/lib/connections'
import AnthropeumPlay, { type ArtifactDay } from '@/components/daily/AnthropeumPlay'
import KrillionPlay, { type KrillionPuzzle } from '@/components/daily/KrillionPlay'

type Daily = { day: string; sourceDate: string; puzzle: unknown }

/** How each game plays, in the order a new player needs it. */
const HOW: Record<Exclude<GameId, 'bee'>, string[]> = {
  connections: [
    'Find 4 groups of 4 words that share something.',
    'Select 4 words and tap Submit. A wrong guess costs 1 of your 4 mistakes.',
    '"One away..." means 3 of your 4 words belong together.',
    'Groups run from easiest (yellow) to hardest (purple).',
  ],
  mini: [
    'Fill the grid. Tap a square twice, or press Space, to switch Across and Down.',
    'Tab jumps to the next clue. The timer pauses when you leave the page.',
    'Check, Reveal or Autocheck mark your solve as assisted, which does not rank.',
  ],
  krillion: [
    '7 prompts, 25 seconds each after a 3-second preview.',
    'Name 1 answer per prompt. Rarer accepted answers score more, up to 100.',
    'Wrong answers can be retried while the clock runs.',
  ],
  anthropeum: [
    '10 museum artifacts. Pin where each was made and pick a 250-year period.',
    'Each artifact scores up to 5,000 for place and 5,000 for time.',
  ],
}

/**
 * Renders the daily game for the `?d=` day, or today.
 */
export default function DailyGame({ game }: { game: Exclude<GameId, 'bee'> }) {
  const params = useSearchParams()
  const raw = params.get('d')
  const day = validDay(raw) && raw >= DAILY_EPOCH && raw <= '2100-12-31' ? raw : siteDay()
  const [response, setResponse] = useState<{ key: string; data?: Daily; error?: string } | null>(null)
  const key = `${game}:${day}`
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/daily/${game}?d=${day}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Could not load puzzle')
        setResponse({ key, data })
      })
      .catch((e) => {
        if (!controller.signal.aborted) setResponse({ key, error: e instanceof Error ? e.message : 'Could not load puzzle' })
      })
    return () => controller.abort()
  }, [key, game, day])
  const data = response?.key === key ? response.data : undefined
  const error = response?.key === key ? response.error : undefined
  const info = (
    <>
      <ul className="list-disc space-y-1 pl-4">
        {HOW[game].map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p style={{ color: 'var(--ink-muted)' }}>Scoring: {GAMES[game].rules}</p>
      <p style={{ color: 'var(--ink-muted)' }}>
        Everyone gets the same puzzle each day (Pacific time)
        {data?.sourceDate && data.sourceDate !== day ? `, picked from the ${data.sourceDate} archive.` : '.'}
      </p>
      {(game === 'mini' || game === 'connections') && (
        <Link className="block underline" href="/games/archives">
          Browse past puzzles
        </Link>
      )}
    </>
  )
  return (
    <div className={`daily-game mx-auto w-full ${game==='anthropeum'?'max-w-none':game==='krillion'?'max-w-5xl':'max-w-4xl'}`} data-testid={`daily-${game}`}>
      <DayNav title={GAMES[game].title} path={GAMES[game].url} day={day} info={info} />
      {data && day <= siteDay() && isPracticeResult(game, day) && (
        <p className="mb-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
          Started as a future preview · not ranked
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border p-4">
          {error}
        </p>
      )}
      {!data && !error && <p style={{ color: 'var(--ink-muted)' }}>Loading the daily puzzle…</p>}
      {data && game === 'mini' && <MiniPlay key={key} puzzle={data.puzzle as MiniPuzzle} dailyDay={day} />}
      {data && game === 'connections' && (
        <ConnectionsPlay
          key={key}
          basePath="/games/connections"
          idOrSlug={(data.puzzle as ConnectionsPuzzle).slug}
          initialPuzzle={data.puzzle as ConnectionsPuzzle}
          dailyDay={day}
        />
      )}
      {data && game === 'anthropeum' && <AnthropeumPlay key={key} puzzle={data.puzzle as ArtifactDay} dailyDay={day} />}
      {data && game === 'krillion' && <KrillionPlay key={key} puzzle={data.puzzle as KrillionPuzzle} dailyDay={day} />}
    </div>
  )
}
