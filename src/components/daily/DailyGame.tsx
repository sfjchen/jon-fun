'use client'

/**
 * Loads one day's puzzle for a daily game and renders it under the shared header.
 */

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DayNav, { action } from '@/components/daily/DayNav'
import type { MiniPuzzle } from '@/components/mini/MiniPlay'
import { firstDay, isNytGame, playableDay, siteDay } from '@/lib/daily'
import { usePlayDay } from '@/lib/play-day'
import { useDailyPuzzle } from '@/lib/use-daily-puzzle'
import { GAMES, getPlayer, isPracticeResult, resultLabel } from '@/lib/results'
import { useSavedRun, type DailyGameId } from '@/lib/daily/saved-run'
import type { ConnectionsPuzzle } from '@/lib/connections'
import type { ArtifactDay } from '@/components/daily/AnthropeumPlay'
import type { KrillionPuzzle } from '@/components/daily/KrillionPlay'
import type { OrbsPuzzle } from '@/lib/orbs'
import type { FivefoldPuzzle } from '@/components/daily/FivefoldPlay'

/** Each game page downloads only its own player, so Wordle does not carry the Anthropeum map or the Mini grid. */
const LOAD = {
  mini: () => import('@/components/mini/MiniPlay'),
  connections: () => import('@/components/connections/ConnectionsPlay'),
  anthropeum: () => import('@/components/daily/AnthropeumPlay'),
  krillion: () => import('@/components/daily/KrillionPlay'),
  orbs: () => import('@/components/daily/OrbsPlay'),
  fivefold: () => import('@/components/daily/FivefoldPlay'),
}
const MiniPlay = dynamic(LOAD.mini)
const ConnectionsPlay = dynamic(LOAD.connections)
const AnthropeumPlay = dynamic(LOAD.anthropeum)
const KrillionPlay = dynamic(LOAD.krillion)
const OrbsPlay = dynamic(LOAD.orbs)
const FivefoldPlay = dynamic(LOAD.fivefold)

/** How each game plays, in the order a new player needs it. */
const HOW: Record<DailyGameId, string[]> = {
  connections: [
    'Find 4 groups of 4 words that share something.',
    'Select 4 words and tap Submit. A wrong guess costs 1 of your 4 mistakes.',
    '"One away..." means 3 of your 4 words belong together.',
    'Groups run from easiest (yellow) to hardest (purple).',
  ],
  mini: [
    'Fill the grid. Tap a square twice, or press Space, to switch Across and Down.',
    'Tab jumps to the next clue. The timer pauses when you leave the page.',
    'Autocheck marks wrong letters as you type and still ranks. Check and Reveal mark your solve as assisted, which does not rank.',
  ],
  krillion: [
    '7 prompts, 25 seconds each.',
    'Name 1 answer per prompt. Rarer accepted answers score more, up to 100.',
    'Wrong answers can be retried while the clock runs.',
  ],
  fivefold: [
    'Find the hidden 5-letter word in 6 tries. Type or tap letters, then Enter.',
    'A green tile is in the right spot. A yellow tile is in the word but in another spot. A gray tile is not in the word.',
    'Hard mode (optional, stays on until you turn it off, starts before a first guess): green letters stay put and yellow letters must be reused.',
  ],
  orbs: [
    'Open any puzzle to start. In matching puzzles, tap one tile from each column.',
    'Correct answers earn orbs. A miss uses one of that puzzle’s three lives.',
  ],
  anthropeum: [
    '10 museum artifacts. Pin where each was made and pick a 250-year period.',
    'Each artifact scores up to 5,000 for place and 5,000 for time.',
  ],
}

/**
 * Renders the daily game for the `?d=` day, or today.
 */
export default function DailyGame({ game }: { game: DailyGameId }) {
  const params = useSearchParams()
  const raw = params.get('d')
  const day = usePlayDay(playableDay(game, raw) ? raw : null, game)
  const { data: loaded, error, retry } = useDailyPuzzle(game, day)
  // A day already finished under this name opens on its saved result, so the game waits for that check.
  const saved = useSavedRun(game, day, loaded?.puzzle)
  const data = saved.ready && !saved.played ? loaded : undefined
  // A run finished on another device while this page was open remounts the game on its result.
  const key = `${game}:${day}:${saved.rev}`
  // Fetches the player's code alongside the puzzle instead of after it.
  useEffect(() => void LOAD[game](), [game])
  const info = (
    <>
      <ul className="list-disc space-y-1 pl-4">
        {HOW[game].map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {isNytGame(game) && <p>Original NYT puzzle for the selected publication date.</p>}
      <p style={{ color: 'var(--ink-muted)' }}>Scoring: {GAMES[game].rules}</p>
      <p style={{ color: 'var(--ink-muted)' }}>Everyone gets the same puzzle each day (Pacific time).</p>
      {game === 'orbs' && (
        <Link className="block underline" href="/games/orbs/archive">
          Browse categories
        </Link>
      )}
      {isNytGame(game) && (
        <Link className="block underline" href="/games/archives">
          Browse past puzzles
        </Link>
      )}
    </>
  )
  return (
    <div
      className={`daily-game mx-auto w-full ${game === 'anthropeum' || game === 'krillion' ? 'max-w-none' : game === 'fivefold' ? 'max-w-lg md:max-w-xl' : game === 'orbs' ? 'max-w-3xl' : 'max-w-4xl'}`}
      data-testid={`daily-${game}`}
    >
      <DayNav
        title={GAMES[game].title}
        path={GAMES[game].url}
        day={day}
        publishedOnly={isNytGame(game)}
        minDay={firstDay(game)}
        info={info}
      >
        {game === 'mini' && day <= siteDay() && (
          <Link className={action} href={`/games/crossword?edition=mini&d=${day}`}>
            Play together
          </Link>
        )}
        {game === 'orbs' && (
          <Link className="px-2 py-1.5 text-sm font-medium underline" href="/games/orbs/archive">
            Archive
          </Link>
        )}
      </DayNav>
      {data && day <= siteDay() && isPracticeResult(game, day) && (
        <p className="mb-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
          Started as a future preview · not ranked
        </p>
      )}
      {error && (
        <div className="rounded-lg border p-4">
          <p role="alert">{error}</p>
          <button type="button" className="mt-2 underline" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {!data && !error && !saved.played && <p style={{ color: 'var(--ink-muted)' }}>Loading the daily puzzle…</p>}
      {saved.played && (
        <div className="rounded-xl bg-[var(--ink-paper)] p-4 text-center" data-testid="daily-played">
          <h2 className="text-xl font-bold">{resultLabel({ game, day, ...saved.played })}</h2>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {getPlayer()?.name} already played this day · saved to your daily scores
          </p>
        </div>
      )}
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
      {data && game === 'orbs' && <OrbsPlay key={key} puzzle={data.puzzle as OrbsPuzzle} dailyDay={day} />}
      {data && game === 'fivefold' && <FivefoldPlay key={key} puzzle={data.puzzle as FivefoldPuzzle} dailyDay={day} />}
      {data && game === 'krillion' && <KrillionPlay key={key} puzzle={data.puzzle as KrillionPuzzle} dailyDay={day} />}
    </div>
  )
}
