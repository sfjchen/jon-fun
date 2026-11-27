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
  return (
    <section className="space-y-4">
      <p>One guess per round. This local edition awards the published answer points. Unlisted words earn zero.</p>
      {round && (
        <form
          className="space-y-3 rounded-xl border p-5"
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
          <p>
            Round {moves.length + 1} of 5 ·{' '}
            {round.anchors.length === 1 ? 'Closest connection' : 'Find the connecting word'}
          </p>
          <h2 className="text-2xl font-semibold">{round.anchors.join(' · ')}</h2>
          <label>
            Your word{' '}
            <input
              className="rounded border p-2"
              required
              maxLength={64}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
            />
          </label>
          <button className="rounded border px-4 py-2">Guess</button>
        </form>
      )}
      <ol>
        {moves.map((word, i) => (
          <li key={i}>
            {i + 1}. {word} · {points[i]} points · Answer: {puzzle.pairs[i]!.answers[0]!.word}
          </li>
        ))}
      </ol>
      <strong>{total}/5000</strong>
      {!round && (
        <div>
          <button
            className="underline"
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
      <p role="status" className="whitespace-pre-line">
        {notice}
      </p>
    </section>
  )
}
