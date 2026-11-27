'use client'

import { useEffect, useState } from 'react'
import { rooms, roomPoints, type Party, type Question, type Guess } from '@/lib/headcount'
import { runKey } from '@/lib/daily/saved-run'
import { logResult } from '@/lib/results'

function Room({ q, onGuess }: { q: Question; onGuess: (g: Guess) => void }) {
  const [values, setValues] = useState<number[]>(
    q.type === 'ranking'
      ? q.options.map((_, i) => i)
      : q.type === 'pie'
        ? q.options.map((_, i) => (i === 0 ? 100 : 0))
        : q.type === 'split'
          ? [50]
          : [],
  )
  const update = (i: number, x: number) =>
    setValues((prev) => {
      const next = [...prev]
      next[i] = x
      return next
    })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (roomPoints(q, values) !== null) onGuess(values)
      }}
    >
      <h2 className="text-2xl font-bold">{q.text}</h2>
      {q.type === 'split' && (
        <label className="block">
          {q.options[0]} · {values[0]}%
          <input
            className="block w-full"
            type="range"
            min="0"
            max="100"
            value={values[0]}
            onChange={(e) => update(0, +e.target.value)}
          />
          {q.options[1]} · {100 - values[0]!}%
        </label>
      )}
      {q.type === 'typical' && (
        <label>
          Guess the median ({q.unit ?? 'number'}){' '}
          <input
            required
            min="0"
            step="any"
            type="number"
            className="w-28 rounded border bg-transparent p-2"
            value={values[0] ?? ''}
            onChange={(e) => setValues(e.target.value === '' ? [] : [+e.target.value])}
          />
        </label>
      )}
      {q.type === 'underdog' && (
        <fieldset>
          <legend>Which answer got {Math.min(...q.crowd)}%?</legend>
          {q.options.map((option, i) => (
            <label className="block p-2" key={option}>
              <input type="radio" name="underdog" checked={values[0] === i} onChange={() => update(0, i)} /> {option}
            </label>
          ))}
        </fieldset>
      )}
      {q.type === 'ranking' && (
        <fieldset>
          <legend>Rank the answers from most picked to least picked.</legend>
          {values.map((option, i) => (
            <div key={option} className="flex items-center gap-3 border-b py-2">
              <span className="flex-1">
                {i + 1}. {q.options[option]}
              </span>
              {[-1, 1].map((step) => (
                <button
                  key={step}
                  type="button"
                  disabled={i + step < 0 || i + step >= values.length}
                  aria-label={q.options[option] + ' ' + (step < 0 ? 'up' : 'down')}
                  onClick={() => {
                    const next = [...values]
                    next[i] = next[i + step]!
                    next[i + step] = option
                    setValues(next)
                  }}
                >
                  {step < 0 ? '↑' : '↓'}
                </button>
              ))}
            </div>
          ))}
        </fieldset>
      )}
      {q.type === 'pie' && (
        <fieldset>
          <legend>Split 100% among the answers.</legend>
          {q.options.map((option, i) => (
            <label key={option} className="flex items-center justify-between py-1">
              {option}
              <input
                className="w-20 rounded border bg-transparent p-1"
                aria-label={option + ' percent'}
                type="number"
                min="0"
                max="100"
                value={values[i]}
                onChange={(e) => update(i, +e.target.value)}
              />
            </label>
          ))}
          <p>Total {values.reduce((a, b) => a + b, 0)}%</p>
        </fieldset>
      )}
      <button
        disabled={roomPoints(q, values) === null}
        className="rounded-lg bg-amber-300 px-4 py-2 font-bold text-black disabled:opacity-50"
      >
        Lock in
      </button>
    </form>
  )
}

export default function HeadcountPlay({ puzzle }: { puzzle: Party }) {
  const key = runKey('headcount', puzzle.date, puzzle.date)
  const [moves, setMoves] = useState<Guess[] | null>(null)
  const [reveal, setReveal] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    try {
      const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      setMoves(
        Array.isArray(v) &&
          v.length <= 5 &&
          v.every((g, i) => Array.isArray(g) && roomPoints(puzzle.questions[i]!, g) !== null)
          ? v
          : [],
      )
    } catch {
      setMoves([])
    }
  }, [key, puzzle])
  if (!moves) return <p>Opening the party…</p>
  const points = moves.map((g, i) => roomPoints(puzzle.questions[i]!, g)!)
  const total = points.reduce((a, b) => a + b, 0)
  const index = moves.length - (reveal ? 1 : 0)
  const q = puzzle.questions[index]
  const share =
    'Headcount #' +
    puzzle.number +
    ' · ' +
    total +
    '/100\n' +
    points.map((n) => (n === 20 ? '🌕' : n >= 15 ? '🌔' : n >= 10 ? '🌓' : n > 0 ? '🌒' : '🌑')).join('')
  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-2xl border-2 border-amber-300 bg-slate-950 p-5 text-amber-50">
      <p className="font-mono tracking-wide uppercase">
        Party #{puzzle.number} · {rooms[index] ?? 'End of the night'}
      </p>
      {q &&
        (reveal ? (
          <div className="space-y-3">
            <h2>{q.text}</h2>
            <p>
              {q.type === 'typical'
                ? 'Median: ' + q.median + ' ' + (q.unit ?? '')
                : q.options.map((o, i) => o + ' ' + q.crowd[i] + '%').join(' · ')}
            </p>
            <strong>{points[index]}/20</strong>
            <div>
              <button className="underline" onClick={() => setReveal(false)}>
                {index === 4 ? 'See result' : 'Next room'}
              </button>
            </div>
          </div>
        ) : (
          <Room
            key={index}
            q={q}
            onGuess={(guess) => {
              const next = [...moves, guess]
              try {
                localStorage.setItem(key, JSON.stringify(next))
              } catch {
                setNotice('Progress could not be saved on this device.')
              }
              setMoves(next)
              setReveal(true)
              if (next.length === 5)
                logResult('headcount', total + roomPoints(q, guess)!, 5, puzzle.date, {
                  moves: next,
                  sourceDate: puzzle.date,
                })
            }}
          />
        ))}
      <p>{total}/100</p>
      {!q && (
        <>
          <p>{share.split('\n')[1]}</p>
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
        </>
      )}
      <p role="status">{notice}</p>
    </section>
  )
}
