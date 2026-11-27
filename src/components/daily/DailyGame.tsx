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
import { GAME_KEYS } from '@/lib/game-keys'
import { GAMES, getPlayer, isPracticeResult, resultLabel } from '@/lib/results'
import { useSavedRun, type DailyGameId } from '@/lib/daily/saved-run'
import type { ConnectionsPuzzle } from '@/lib/connections'
import type { ArtifactDay } from '@/components/daily/AnthropeumPlay'
import type { KrillionPuzzle } from '@/components/daily/KrillionPlay'
import type { Party } from '@/lib/headcount'
import type { KabloomPuzzle } from '@/lib/kabloom'
import type { Edition } from '@/lib/daily/chainle'
import type { FivefoldPuzzle } from '@/components/daily/FivefoldPlay'
import { GEO, type BallparkPuzzle, type HopPuzzle, type OutlinePuzzle, type PinPuzzle } from '@/lib/geo-games'

/** Each game page downloads only its own player, so Wordle does not carry the Anthropeum map or the Mini grid. */
const LOAD = {
  kabloom: () => import('@/app/games/kabloom/play'),
  headcount: () => import('@/app/games/headcount/play'),
  chainle: () => import('@/app/games/chainle/play'),
  mini: () => import('@/components/mini/MiniPlay'),
  connections: () => import('@/components/connections/ConnectionsPlay'),
  anthropeum: () => import('@/components/daily/AnthropeumPlay'),
  krillion: () => import('@/components/daily/KrillionPlay'),
  fivefold: () => import('@/components/daily/FivefoldPlay'),
  outline: () => import('@/components/geo/OutlinePlay'),
  hop: () => import('@/components/geo/HopPlay'),
  pin: () => import('@/components/geo/PinPlay'),
  ballpark: () => import('@/components/geo/BallparkPlay'),
}
const MiniPlay = dynamic(LOAD.mini)
const ConnectionsPlay = dynamic(LOAD.connections)
const AnthropeumPlay = dynamic(LOAD.anthropeum)
const KrillionPlay = dynamic(LOAD.krillion)
const KabloomPlay = dynamic(LOAD.kabloom)
const HeadcountPlay = dynamic(LOAD.headcount)
const ChainlePlay = dynamic(LOAD.chainle)
const FivefoldPlay = dynamic(LOAD.fivefold)
const OutlinePlay = dynamic(LOAD.outline)
const HopPlay = dynamic(LOAD.hop)
const PinPlay = dynamic(LOAD.pin)
const BallparkPlay = dynamic(LOAD.ballpark)

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
  kabloom: [
    '7 rounds up the volcano. Each prompt has a short reading clock, then 25 seconds to answer.',
    'Wrong answers can be retried while the clock runs. Each answer works once, so an early pick can leave a later round with nothing left.',
    'A close misspelling comes back as a suggestion. Send it again to confirm.',
    'The climb ends at the summit or when a clock runs out.',
  ],
  headcount: ['Predict the crowd’s split, ranking, median, underdog and pie. Lock in one guess per room.'],
  chainle: [
    'One word per round. Find the connection between the clues in the first four rounds and the closest word in round five.',
  ],
  anthropeum: [
    '10 museum artifacts. Pin where each was made and pick a 250-year period.',
    'Each artifact scores up to 5,000 for place and 5,000 for time.',
  ],
  outline: [
    'Name the country whose shape is shown. You have 6 guesses.',
    'A miss shows how far its centre is from the answer’s, and an arrow pointing the way.',
    'Type a few letters and pick from the list. A name that only 1 country starts with is enough.',
  ],
  hop: [
    'Name countries that link the 2 ends through shared land borders, in any order.',
    'The game ends when your countries form an unbroken route, or the guesses run out.',
    'Green is on a shortest route, yellow adds up to 2 countries, red is further off.',
  ],
  pin: [
    'Find 5 cities. Tap the map to place your pin, then lock it in.',
    'The map names countries but no cities. Closer pins score more, up to 1,000 each.',
  ],
  ballpark: [
    '3 questions with a number for an answer. Type your best estimate.',
    'You can write 1,200, 3.5 million or 2b. Being 2 times off still scores 70 of 100.',
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
      {game in GEO && <p>Made on sfjc.dev from Natural Earth map data, which is in the public domain.</p>}
      <p style={{ color: 'var(--ink-muted)' }}>Scoring: {GAMES[game].rules}</p>
      <p style={{ color: 'var(--ink-muted)' }}>Everyone gets the same puzzle each day (Pacific time).</p>
      {isNytGame(game) && (
        <Link className="block underline" href="/games/archives">
          Browse past puzzles
        </Link>
      )}
    </>
  )
  return (
    <div
      className={`daily-game mx-auto w-full ${game === 'anthropeum' || game === 'krillion' ? 'max-w-none' : game === 'fivefold' ? 'max-w-lg md:max-w-xl' : 'max-w-4xl'}`}
      data-testid={`daily-${game}`}
    >
      <DayNav
        title={GAMES[game].title}
        path={GAMES[game].url}
        day={day}
        publishedOnly={isNytGame(game) || game === 'chainle' || game === 'headcount' || game === 'kabloom'}
        minDay={firstDay(game)}
        info={info}
        keys={GAME_KEYS[game]}
      >
        {game === 'mini' && day <= siteDay() && (
          <Link className={action} href={`/games/crossword?edition=mini&d=${day}`}>
            Play together
          </Link>
        )}
        {(game === 'chainle' || game === 'headcount' || game === 'kabloom') && (
          <Link className={action} href={`/games/${game}/archive`}>
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
      {data && game === 'kabloom' && <KabloomPlay key={key} puzzle={data.puzzle as KabloomPuzzle} dailyDay={day} />}
      {data && game === 'headcount' && <HeadcountPlay key={key} puzzle={data.puzzle as Party} />}
      {data && game === 'chainle' && <ChainlePlay key={key} puzzle={data.puzzle as Edition} />}
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
      {data && game === 'outline' && <OutlinePlay key={key} puzzle={data.puzzle as OutlinePuzzle} />}
      {data && game === 'hop' && <HopPlay key={key} puzzle={data.puzzle as HopPuzzle} />}
      {data && game === 'pin' && <PinPlay key={key} puzzle={data.puzzle as PinPuzzle} />}
      {data && game === 'ballpark' && <BallparkPlay key={key} puzzle={data.puzzle as BallparkPuzzle} />}
    </div>
  )
}
