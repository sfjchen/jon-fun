'use client'

/*
 * Score grid shared by the Daily drawer and the leaderboard: a row per player and a column per daily game, headed by
 * the game's doodle, with all 6 games shown and a dash where a player has no result.
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
}

/**
 * Renders the grid. The best result in each column, ties included, is bold, and the saved player's row is shaded.
 * Hovering a cell on a laptop shows the full result. With a picked game the other columns fade.
 */
export default function ScoreTable({ rows, me, q, wins, color, game = 'all', onGame }: ScoreTableProps) {
  const best = new Map(GAME_IDS.map((g) => [g, rows.filter((r) => r.game === g).sort(compareResults)[0]]))
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
            {GAME_IDS.map((g) => {
              const icon = (
                <Image src={`/doodles/notebook/${g}.svg`} alt="" width={24} height={24} className="mx-auto h-6 w-6" />
              )
              return (
                <th key={g} scope="col" className="pb-1.5 font-normal">
                  {onGame ? (
                    <button
                      type="button"
                      aria-label={GAMES[g].title}
                      aria-pressed={game === g}
                      onClick={() => onGame(g)}
                      {...tip.on(game === g ? 'Show all games' : GAMES[g].title)}
                      className={
                        'rounded-lg border-b-2 p-1.5 hover:bg-[var(--ink-paper)] ' +
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
              {GAME_IDS.map((g, i) => {
                const r = rows.find((x) => x.name === n && x.game === g)
                const top = r && compareResults(r, best.get(g)!) === 0
                const edge = i === GAME_IDS.length - 1 ? 'rounded-r-md' : ''
                return (
                  <td
                    key={g}
                    className={
                      `px-0.5 py-1.5 text-center leading-tight tabular-nums transition-opacity ${edge} ` +
                      `${game !== 'all' && game !== g ? 'opacity-35' : ''} ` +
                      (top ? 'font-semibold text-[var(--ink-text)]' : 'text-[var(--ink-muted)]')
                    }
                  >
                    {r ? (
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
