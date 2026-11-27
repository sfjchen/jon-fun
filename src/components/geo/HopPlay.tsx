'use client'

/**
 * Border hop: names countries until they link the day's 2 ends through shared land borders. Each guess is rated by
 * the detour it adds to the shortest route.
 */

import { hopDetour, hopRun, hops, type HopPuzzle } from '@/lib/geo-games'
import { card, Finished, PlaceInput, useMoves } from './shared'

export default function HopPlay({ puzzle }: { puzzle: HopPuzzle }) {
  const [moves, run, play] = useMoves<string>('hop', puzzle.date, (m) => hopRun(puzzle, m))
  const name = (id: string) => puzzle.countries.find((c) => c.id === id)!.name
  // A shortest route, shown once the game is over: from the far end, step to any neighbour 1 crossing closer.
  const steps = hops(puzzle.countries, puzzle.from),
    route = [puzzle.to]
  while (run.done && route[0] !== puzzle.from)
    route.unshift(
      puzzle.countries.find((c) => c.id === route[0])!.nb.find((n) => steps.get(n) === steps.get(route[0]!)! - 1)!,
    )
  const marks = moves.map((id) => {
    const d = hopDetour(puzzle, id)
    return d === 0 ? '🟩' : d !== null && d <= 2 ? '🟨' : '🟥'
  })
  return (
    <section className="mx-auto w-full max-w-xl space-y-3">
      <div className={`${card} space-y-1 text-center`}>
        <h2 className="text-2xl font-bold">
          {name(puzzle.from)} → {name(puzzle.to)}
        </h2>
        <p className="text-sm text-[var(--ink-muted)]">
          The shortest route passes through {puzzle.best} {puzzle.best === 1 ? 'country' : 'countries'} ·{' '}
          {puzzle.limit - moves.length} guesses left
        </p>
      </div>
      {!run.done && (
        <div className={card}>
          <PlaceInput
            list={puzzle.countries.filter((c) => c.id !== puzzle.from && c.id !== puzzle.to)}
            used={moves}
            label="Country on the way"
            onPick={(c) => play(c.id)}
          />
          <p className="text-xs text-[var(--ink-muted)]">
            🟩 on a shortest route · 🟨 up to 2 countries longer · 🟥 further off or not linked by land
          </p>
        </div>
      )}
      {moves.length > 0 && (
        <ol className={`${card} space-y-2 text-sm`}>
          {moves.map((id, i) => (
            <li key={id} className="flex items-baseline justify-between gap-3">
              <strong>{name(id)}</strong>
              <span aria-label={marks[i] === '🟩' ? 'on a shortest route' : marks[i] === '🟨' ? 'close' : 'off route'}>
                {marks[i]}
              </span>
            </li>
          ))}
        </ol>
      )}
      {run.done && (
        <Finished
          title={run.solved ? `${run.score}/100` : 'No route · 0/100'}
          share={`Border hop · ${puzzle.date} · ${run.score}/100\n${marks.join('')}\nsfjc.dev`}
        >
          <p className="text-sm">A shortest route: {route.map(name).join(' → ')}</p>
        </Finished>
      )}
    </section>
  )
}
