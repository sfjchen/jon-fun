'use client'

import { useEffect, useState } from 'react'
import type { Edition } from '@/lib/daily/chainle'
import { runKey } from '@/lib/daily/saved-run'
import { logResult } from '@/lib/results'
import { chainlePoints } from '@/lib/chainle-score'

export default function ChainlePlay({ puzzle }: { puzzle: Edition }) {
  const key = runKey('chainle', puzzle.date, puzzle.date)
  const [moves, setMoves] = useState<string[] | null>(null)
  const [guess, setGuess] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    function restore() {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
        setMoves(Array.isArray(value) && value.length <= 5 && value.every((x) => typeof x === 'string') ? value : [])
      } catch {
        setMoves([])
      }
    }
    restore()
    window.addEventListener('storage', restore)
    return () => window.removeEventListener('storage', restore)
  }, [key])
  if (!moves) return <p>Loading round…</p>
  const round = puzzle.pairs[moves.length]
  const points = moves.map((word, i) => {
    return chainlePoints(puzzle.pairs[i]!, word)
  })
  const total = points.reduce((a, b) => a + b, 0)
  const share = 'Chainle · ' + puzzle.date + '\n' + points.join(' · ') + '\n' + total + '/5000 · sfjc.dev'
  const card = 'rounded-xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-4 sm:p-5'
  return (
    <section className="mx-auto w-full max-w-xl space-y-3">
      <div className={`${card} flex items-center justify-between py-3 font-semibold`}>
        <p>{round ? `Round ${moves.length + 1} of 5` : 'Finished'}</p>
        <p className="tabular-nums" data-testid={round ? undefined : 'chainle-result'}>
          {total.toLocaleString('en-US')}/5,000
        </p>
      </div>
      {round && (
        <form
          className={`${card} space-y-3`}
          onSubmit={(e) => {
            e.preventDefault()
            const word = guess.trim().toLowerCase()
            if (!word) return
            const next = [...moves, word]
            if (next.length === 5)
              logResult('chainle', total + chainlePoints(round, word), 5, puzzle.date, {
                moves: next,
                sourceDate: puzzle.date,
              })
            setMoves(next)
            try {
              localStorage.setItem(key, JSON.stringify(next))
            } catch {
              setNotice('Progress is available only in this tab.')
            }
            setGuess('')
          }}
        >
          <p className="text-sm text-[var(--ink-muted)]">
            {round.anchors.length === 1 ? 'Closest connection' : 'Find the connecting word'} · 1 guess
          </p>
          <h2 className="text-2xl font-bold">{round.anchors.join(' · ')}</h2>
          <div className="flex gap-2">
            <input
              aria-label="Your word"
              placeholder="Your word"
              autoComplete="off"
              autoCapitalize="none"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2"
              required
              maxLength={64}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
            />
            <button className="rounded-lg bg-[var(--game-color)] px-5 py-2 font-semibold text-white">Guess</button>
          </div>
          <p className="text-xs text-[var(--ink-muted)]">
            Published answers earn their listed points. Other words earn 0.
          </p>
        </form>
      )}
      {moves.length > 0 && (
        <ol className={`${card} space-y-2 text-sm`}>
          {moves.map((word, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span>
                <span className="text-[var(--ink-muted)]">{puzzle.pairs[i]!.anchors.join(' · ')}</span>{' '}
                <strong>{word}</strong>
              </span>
              <span className="text-[var(--ink-muted)] tabular-nums">
                {points[i]} · answer {puzzle.pairs[i]!.answers[0]!.word}
              </span>
            </li>
          ))}
        </ol>
      )}
      {!round && (
        <div className={`${card} space-y-2 text-center`}>
          <h2 className="text-xl font-bold">{total.toLocaleString('en-US')} points</h2>
          <p className="text-sm text-[var(--ink-muted)]">Saved to your daily scores</p>
          <button
            className="rounded-full bg-[var(--game-color)] px-5 py-2 text-sm font-semibold text-white"
            data-hotkey="s"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(share)
                setNotice('Result copied.')
              } catch {
                setNotice(share)
              }
            }}
          >
            Copy result
          </button>
        </div>
      )}
      <p role="status" className="min-h-5 text-sm whitespace-pre-line text-[var(--ink-muted)]">
        {notice}
      </p>
    </section>
  )
}
