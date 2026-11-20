'use client'

/**
 * Loads one day's puzzle for a daily game and renders it under the shared header.
 */

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DayNav from '@/components/daily/DayNav'
import MiniPlay, { type MiniPuzzle } from '@/components/mini/MiniPlay'
import ConnectionsPlay from '@/components/connections/ConnectionsPlay'
import { DAILY_EPOCH, siteDay, validDay } from '@/lib/daily'
import { usePlayDay } from '@/lib/play-day'
import { useDailyPuzzle } from '@/lib/use-daily-puzzle'
import { GAMES, isPracticeResult, type GameId } from '@/lib/results'
import type { ConnectionsPuzzle } from '@/lib/connections'
import AnthropeumPlay, { type ArtifactDay } from '@/components/daily/AnthropeumPlay'
import KrillionPlay, { type KrillionPuzzle } from '@/components/daily/KrillionPlay'
import FivefoldPlay, { type FivefoldPuzzle } from '@/components/daily/FivefoldPlay'

import { isNytGame, NYT_FIRST_DAY } from '@/lib/daily/nyt-puzzles'

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
    '7 prompts, 25 seconds each.',
    'Name 1 answer per prompt. Rarer accepted answers score more, up to 100.',
    'Wrong answers can be retried while the clock runs.',
  ],
  fivefold: [
    'Find the hidden 5-letter word in 6 tries. Type or tap letters, then Enter.',
    'A green tile is in the right spot. A yellow tile is in the word but in another spot. A gray tile is not in the word.',
    'Hard mode (optional, set before your first guess): green letters stay put and yellow letters must be reused.',
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
  const min = isNytGame(game) ? NYT_FIRST_DAY[game] : DAILY_EPOCH
  const day = usePlayDay(validDay(raw) && raw >= min && raw <= '2100-12-31' ? raw : null, game)
  const key = `${game}:${day}`
  const { data, error, retry } = useDailyPuzzle(game, day)
  const info = (
    <>
      <ul className="list-disc space-y-1 pl-4">
        {HOW[game].map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {isNytGame(game) && <p>Original NYT puzzle for the selected publication date.</p>}
      <p style={{ color: 'var(--ink-muted)' }}>Scoring: {GAMES[game].rules}</p>
      <p style={{ color: 'var(--ink-muted)' }}>
        Everyone gets the same puzzle each day (Pacific time)
        {data?.sourceDate && data.sourceDate !== day ? `, picked from the ${data.sourceDate} archive.` : '.'}
      </p>
      {(game === 'mini' || game === 'connections' || game === 'fivefold') && (
        <Link className="block underline" href="/games/archives">
          Browse past puzzles
        </Link>
      )}
    </>
  )
  return (
    <div className={`daily-game mx-auto w-full ${game==='anthropeum'||game==='krillion'?'max-w-none':game==='fivefold'?'max-w-lg':'max-w-4xl'}`} data-testid={`daily-${game}`}>
      <DayNav title={GAMES[game].title} path={GAMES[game].url} day={day} publishedOnly={isNytGame(game)} minDay={isNytGame(game) ? NYT_FIRST_DAY[game] : DAILY_EPOCH} info={info} />
      {data && day <= siteDay() && isPracticeResult(game, day) && (
        <p className="mb-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
          Started as a future preview · not ranked
        </p>
      )}
      {error && (
        <div className="rounded-lg border p-4">
          <p role="alert">{error}</p>
          <button type="button" className="mt-2 underline" onClick={retry}>Try again</button>
        </div>
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
      {data && game === 'fivefold' && <FivefoldPlay key={key} puzzle={data.puzzle as FivefoldPuzzle} dailyDay={day} />}
      {data && game === 'krillion' && <KrillionPlay key={key} puzzle={data.puzzle as KrillionPuzzle} dailyDay={day} />}
    </div>
  )
}
