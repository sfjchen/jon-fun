'use client'

/**
 * Pin drop: asks for 5 cities in turn on a map with no city names. A locked pin shows the city and its distance.
 */

import { useState } from 'react'
import MapPicker from '@/components/daily/MapPicker'
import { distanceKm, type Pin } from '@/lib/artifact-scoring'
import { PIN_ROUNDS, pinPoints, pinRun, type PinPuzzle } from '@/lib/geo-games'
import { card, Finished, primary, useMoves } from './shared'

export default function PinPlay({ puzzle }: { puzzle: PinPuzzle }) {
  const [moves, run, play] = useMoves<Pin>('pin', puzzle.date, (m) => pinRun(puzzle, m))
  const [pin, setPin] = useState<Pin | null>(null)
  // The round whose locked pin is on show, until Next moves on to the following city.
  const [shown, setShown] = useState<number | null>(null)
  const round = shown ?? Math.min(moves.length, PIN_ROUNDS - 1),
    city = puzzle.cities[round]!,
    locked = moves[round]
  const points = moves.map((p, i) => pinPoints(puzzle.cities[i]!, p))
  return (
    <section className="mx-auto w-full max-w-4xl space-y-3">
      <div className={`${card} flex flex-wrap items-center justify-between gap-2 py-3`}>
        <div>
          <p className="text-sm text-[var(--ink-muted)]">
            City {round + 1} of {PIN_ROUNDS} · {run.score.toLocaleString('en-US')} points
          </p>
          <h2 className="text-xl font-bold">
            {city.name}, {city.country}
          </h2>
        </div>
        {locked ? (
          <p className="text-sm tabular-nums" role="status">
            {Math.round(distanceKm(city, locked)).toLocaleString('en-US')} km away · {points[round]} points
          </p>
        ) : (
          <button
            className={primary}
            disabled={!pin}
            data-hotkey="Enter"
            onClick={() => {
              play(pin!)
              setShown(round)
              setPin(null)
            }}
          >
            Lock in
          </button>
        )}
        {locked && !run.done && (
          <button className={primary} data-hotkey="Enter" onClick={() => setShown(null)}>
            Next city
          </button>
        )}
      </div>
      <div className="anthro-map h-[55svh] min-h-72 overflow-hidden rounded-xl border border-[var(--ink-border)]">
        <MapPicker
          key={`${round}:${!!locked}`}
          hidePlaces
          pin={locked ?? pin}
          onChange={setPin}
          {...(locked ? { target: city } : {})}
        />
      </div>
      {run.done && (
        <Finished
          title={`${run.score.toLocaleString('en-US')}/5,000`}
          share={`Pin drop · ${puzzle.date} · ${run.score}/5000\n${points.join(' · ')}\nsfjc.dev`}
        />
      )}
    </section>
  )
}
