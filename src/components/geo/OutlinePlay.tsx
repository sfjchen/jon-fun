'use client'

/**
 * Outline: shows a country's shape and takes up to 6 guesses. Each miss tells how far away the guess is and which
 * way to go.
 */

import { distanceKm } from '@/lib/artifact-scoring'
import { arrow, outlineRun, OUTLINE_TRIES, type OutlinePuzzle } from '@/lib/geo-games'
import { card, Finished, PlaceInput, useMoves } from './shared'

export default function OutlinePlay({ puzzle }: { puzzle: OutlinePuzzle }) {
  const [moves, run, play] = useMoves<string>('outline', puzzle.date, (m) => outlineRun(puzzle, m))
  const byId = new Map(puzzle.countries.map((c) => [c.id, c])),
    target = byId.get(puzzle.target)!
  const rows = moves.map((id) => {
    const c = byId.get(id)!
    return { ...c, km: Math.round(distanceKm(c, target)), way: id === puzzle.target ? '✓' : arrow(c, target) }
  })
  const tally = `${run.solved ? moves.length : 'X'}/${OUTLINE_TRIES}`
  return (
    <section className="mx-auto w-full max-w-xl space-y-3">
      <div className={`${card} flex justify-center`}>
        <svg viewBox="-4 -4 108 108" className="h-56 w-56 sm:h-64 sm:w-64" role="img" aria-label="The country’s shape">
          <path
            d={puzzle.path}
            fill="var(--game-color)"
            fillOpacity=".18"
            stroke="var(--game-color)"
            strokeWidth=".8"
          />
        </svg>
      </div>
      {!run.done && (
        <div className={card}>
          <p className="mb-2 text-sm text-[var(--ink-muted)]">
            Guess {moves.length + 1} of {OUTLINE_TRIES}
          </p>
          <PlaceInput list={puzzle.countries} used={moves} label="Country" onPick={(c) => play(c.id)} />
        </div>
      )}
      {rows.length > 0 && (
        <ol className={`${card} space-y-2 text-sm`}>
          {rows.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3">
              <strong>{r.name}</strong>
              <span className="text-[var(--ink-muted)] tabular-nums">
                {r.way === '✓' ? '✓' : `${r.km.toLocaleString('en-US')} km ${r.way}`}
              </span>
            </li>
          ))}
        </ol>
      )}
      {run.done && (
        <Finished
          title={`${target.name} · ${tally}`}
          share={`Outline · ${puzzle.date} · ${tally}\n${rows.map((r) => r.way).join(' ')}\nsfjc.dev`}
        />
      )}
    </section>
  )
}
