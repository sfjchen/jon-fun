'use client'

/*
 * Score grid shared by the Daily drawer and the leaderboard: a row per player and a column per daily game, headed by
 * the game's doodle and a dash where a player has no result. The drawer shows a completion
 * mark in each cell, or for the collaborative games the words that player added, and the leaderboard shows the score.
 */
import Image from 'next/image'
import Link from 'next/link'
import { useHoverTip } from '@/components/HoverTip'
import { GAMES, GAME_IDS, compareResults, formatTime, resultLabel, type BoardRow, type GameId } from '@/lib/results'

/**
 * Returns a 1-line label short enough for a grid cell: Connections shows only its solve time (or groups found)
 * and Anthropeum rounds to thousands, so every column stays a similar width.
 */
function cellLabel(r: BoardRow): string {
  if (r.game === 'connections')
    return r.score === 4 && r.stats.seconds !== undefined ? formatTime(r.stats.seconds) : `${r.stats.n ?? r.score}/4`
  if (r.game === 'anthropeum') return `${Math.round(r.score / 1000)}k`
  return resultLabel(r)
}

export type PlayState = 'none' | 'started' | 'done'
const STATE_NAME: Record<PlayState, string> = { none: 'Not done', started: 'Started', done: 'Completed' }

/**
 * Tells how far a result is: Spelling Bee stays started until every word is found, and any other result is a
 * finished game.
 */
export function playState(r: BoardRow | undefined): PlayState {
  return !r ? 'none' : r.game === 'bee' && !r.stats.solved ? 'started' : 'done'
}

/**
 * Returns the words a player added to a collaborative game, which the drawer shows in place of a completion mark:
 * the Spelling Bee words they were first to find (all their words on a result saved before that was counted), or
 * the crossword words they filled in. Any other game has none.
 */
export function ownWords(r: BoardRow): number | undefined {
  return r.game === 'bee' ? (r.stats.own ?? r.stats.n ?? 0) : r.game === 'crossword' ? r.stats.n : undefined
}

/**
 * Names a collaborative result by the player's words and how far the shared game is.
 */
export function wordsLabel(r: BoardRow): string {
  const own = ownWords(r) ?? 0
  const words = `${own} ${own === 1 ? 'word' : 'words'}`
  return r.game === 'bee'
    ? `found ${words}${r.stats.own === undefined ? '' : ` of the ${r.stats.n ?? own} on their list`}`
    : `filled ${words} · ${r.score > 0 ? 'solved' : 'in progress'}`
}

/**
 * Draws a completion mark: an empty ring for not done, a half-filled ring for started and a filled check for
 * completed.
 */
export function Mark({ state, size = 18, label }: { state: PlayState; size?: number; label?: string }) {
  return (
    <svg
      role="img"
      aria-label={label ? `${label}: ${STATE_NAME[state]}` : STATE_NAME[state]}
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={`inline-block ${state === 'none' ? 'text-[var(--ink-border)]' : 'text-[var(--ink-text)]'}`}
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        fill={state === 'done' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
      />
      {state === 'started' && <path d="M10 2a8 8 0 0 1 0 16z" fill="currentColor" />}
      {state === 'done' && (
        <path
          d="M6 10.5l2.7 2.7L14 7.5"
          fill="none"
          stroke="var(--ink-bg)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

type ScoreTableProps = {
  rows: BoardRow[]
  me: string | undefined
  /** The day query (`?d=`) added to each game link, or '' for today. */
  q: string
  /** Game wins per player that day, which puts the day's leader first. Without it the saved player comes first. */
  wins?: Map<string, number>
  /** Gives each name its player color dot. */
  color?: (name: string) => string
  /** The picked game, and the handler that turns the column heads into game filter buttons instead of links. */
  game?: GameId | 'all'
  onGame?: (g: GameId) => void
  /** Shows a completion mark in each cell in place of the score. */
  marks?: boolean
}

/**
 * Renders the grid. The best result in each column, ties included, is bold, and the saved player's row is shaded.
 * Hovering a cell on a laptop shows the full result. With a picked game the other columns fade. With marks, cells
 * hold only completion marks and no result is bold.
 */
export default function ScoreTable({
  rows: allRows,
  me,
  q,
  wins,
  color,
  game = 'all',
  onGame,
  marks,
}: ScoreTableProps) {
  const games = GAME_IDS
  const rows = allRows.filter((row) => games.includes(row.game))
  const best = new Map(games.map((g) => [g, rows.filter((r) => r.game === g).sort(compareResults)[0]]))
  const tip = useHoverTip()
  const count = (n: string) => rows.filter((r) => r.name === n).length
  const names = [...new Set(rows.map((r) => r.name))].sort(
    (a, b) =>
      (wins ? (wins.get(b) ?? 0) - (wins.get(a) ?? 0) : Number(b === me) - Number(a === me)) ||
      count(b) - count(a) ||
      a.localeCompare(b),
  )
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Player
            </th>
            {games.map((g) => {
              const icon = (
                <Image
                  src={`/doodles/notebook/${g}.svg`}
                  alt=""
                  width={24}
                  height={24}
                  className="mx-auto h-5 w-5 sm:h-6 sm:w-6"
                />
              )
              return (
                <th key={g} scope="col" className={`pb-1.5 font-normal`}>
                  {onGame ? (
                    <button
                      type="button"
                      aria-label={GAMES[g].title}
                      aria-pressed={game === g}
                      onClick={() => onGame(g)}
                      {...tip.on(game === g ? 'Show all games' : GAMES[g].title)}
                      className={
                        'rounded-lg border-b-2 p-1 hover:bg-[var(--ink-paper)] sm:p-1.5 ' +
                        (game === g ? 'border-[var(--game-color)] bg-[var(--ink-paper)]' : 'border-transparent')
                      }
                    >
                      {icon}
                    </button>
                  ) : (
                    <Link
                      href={GAMES[g].url + q}
                      aria-label={GAMES[g].title}
                      className="inline-block"
                      {...tip.on(`Play ${GAMES[g].title}`)}
                    >
                      {icon}
                    </Link>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {names.map((n) => (
            <tr key={n} className={n === me ? 'bg-[var(--ink-paper)]' : ''}>
              <th scope="row" {...tip.on(n)} className="rounded-l-md px-1 py-1.5 text-left text-sm font-medium">
                <span className={`flex items-center gap-1.5 ${color ? 'max-w-[6.5rem]' : 'max-w-[5.5rem]'}`}>
                  {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color(n) }} />}
                  <span className="truncate">{n}</span>
                </span>
              </th>
              {games.map((g, i) => {
                const r = rows.find((x) => x.name === n && x.game === g)
                const top = !marks && r && compareResults(r, best.get(g)!) === 0
                const edge = i === games.length - 1 ? 'rounded-r-md' : ''
                return (
                  <td
                    key={g}
                    className={
                      `px-0.5 py-1.5 text-center leading-tight tabular-nums transition-opacity ${edge} ` +
                      `${game !== 'all' && game !== g ? 'opacity-35' : ''} ` +
                      (top ? 'font-semibold text-[var(--ink-text)]' : 'text-[var(--ink-muted)]')
                    }
                  >
                    {marks && r && ownWords(r) !== undefined ? (
                      <span
                        className="font-semibold text-[var(--ink-text)]"
                        {...tip.on(`${n} · ${GAMES[g].title} · ${wordsLabel(r)}`)}
                      >
                        {ownWords(r)}
                      </span>
                    ) : marks ? (
                      <span {...tip.on(`${n} · ${GAMES[g].title} · ${STATE_NAME[playState(r)]}`)}>
                        <Mark state={playState(r)} size={16} />
                      </span>
                    ) : r ? (
                      <span
                        className="whitespace-nowrap"
                        {...tip.on(
                          <>
                            {n} · {GAMES[g].title}
                            <span className="block font-semibold">
                              {resultLabel(r)}
                              {top && ' · best'}
                            </span>
                          </>,
                        )}
                      >
                        {cellLabel(r)}
                      </span>
                    ) : (
                      '–'
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {tip.el}
    </div>
  )
}
