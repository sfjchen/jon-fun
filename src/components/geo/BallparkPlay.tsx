'use client'

/**
 * Ballpark: 3 estimates, each scored by how many times too high or too low it is.
 */

import { useState } from 'react'
import { ballparkPoints, ballparkRun, parseEstimate, type BallparkPuzzle } from '@/lib/geo-games'
import { card, Finished, primary, useMoves } from './shared'

export default function BallparkPlay({ puzzle }: { puzzle: BallparkPuzzle }) {
  const [moves, run, play] = useMoves<number>('ballpark', puzzle.date, (m) => ballparkRun(puzzle, m))
  const [typed, setTyped] = useState('')
  const [notice, setNotice] = useState('')
  const question = puzzle.questions[moves.length]
  const points = moves.map((g, i) => ballparkPoints(puzzle.questions[i]!.answer, g))
  return (
    <section className="mx-auto w-full max-w-xl space-y-3">
      <div className={`${card} flex items-center justify-between py-3 font-semibold`}>
        <p>{question ? `Estimate ${moves.length + 1} of ${puzzle.questions.length}` : 'Finished'}</p>
        <p className="tabular-nums">{run.score}/300</p>
      </div>
      {question && (
        <form
          className={`${card} space-y-3`}
          onSubmit={(e) => {
            e.preventDefault()
            const guess = parseEstimate(typed)
            if (!guess) return setNotice('Type a number above 0, such as 1,200 or 3.5 million.')
            setTyped('')
            setNotice('')
            play(guess)
          }}
        >
          <h2 className="text-xl font-bold">{question.text}</h2>
          <div className="flex items-center gap-2">
            <input
              aria-label={`Your estimate in ${question.unit}`}
              placeholder="Your estimate"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
            <span className="text-sm text-[var(--ink-muted)]">{question.unit}</span>
            <button className={primary}>Lock in</button>
          </div>
          <p role="status" className="min-h-5 text-sm text-[var(--ink-muted)]">
            {notice}
          </p>
        </form>
      )}
      {moves.length > 0 && (
        <ol className={`${card} space-y-3 text-sm`}>
          {moves.map((g, i) => (
            <li key={i}>
              <p className="text-[var(--ink-muted)]">{puzzle.questions[i]!.text}</p>
              <p className="flex flex-wrap justify-between gap-x-3 tabular-nums">
                <span>
                  <strong>{g.toLocaleString('en-US')}</strong> · answer{' '}
                  {puzzle.questions[i]!.answer.toLocaleString('en-US')} {puzzle.questions[i]!.unit}
                </span>
                <span>{points[i]}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
      {run.done && (
        <Finished
          title={`${run.score}/300`}
          share={`Ballpark · ${puzzle.date} · ${run.score}/300\n${points.join(' · ')}\nsfjc.dev`}
        />
      )}
    </section>
  )
}
