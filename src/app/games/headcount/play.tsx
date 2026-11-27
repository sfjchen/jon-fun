'use client'

/**
 * Plays a Headcount party: five rooms of crowd questions, each guess saved on the device and the total logged as the day's result.
 */

import { useState } from 'react'
import { rooms, roomPoints, type Party, type Question, type Guess } from '@/lib/headcount'
import { runKey } from '@/lib/daily/saved-run'
import { logResult } from '@/lib/results'

const field = 'rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] p-1.5'
const card = 'rounded-xl border bg-[var(--ink-paper)] p-4'

/**
 * Collects 1 guess for a room's question in the form its type asks for.
 */
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
      <h2 className="text-lg font-bold">{q.text}</h2>
      {q.type === 'split' && (
        <label className="block">
          {q.options[0]} · {values[0]}%
          <input
            className="block w-full accent-[var(--ink-accent)]"
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
            className={`w-28 ${field}`}
            value={values[0] ?? ''}
            onChange={(e) => setValues(e.target.value === '' ? [] : [+e.target.value])}
          />
        </label>
      )}
      {q.type === 'underdog' && (
        <fieldset>
          <legend>Which answer got {Math.min(...q.crowd)}%?</legend>
          {q.options.map((option, i) => (
            <label className="block rounded-lg p-2 hover:bg-[var(--ink-bg)]" key={option}>
              <input type="radio" name="underdog" checked={values[0] === i} onChange={() => update(0, i)} /> {option}
            </label>
          ))}
        </fieldset>
      )}
      {q.type === 'ranking' && (
        <fieldset>
          <legend>Rank the answers from most picked to least picked.</legend>
          {values.map((option, i) => (
            <div key={option} className="flex items-center gap-3 border-b border-[var(--ink-border)] py-2">
              <span className="flex-1">
                {i + 1}. {q.options[option]}
              </span>
              {[-1, 1].map((step) => (
                <button
                  key={step}
                  type="button"
                  disabled={i + step < 0 || i + step >= values.length}
                  aria-label={q.options[option] + ' ' + (step < 0 ? 'up' : 'down')}
                  className="rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-2 disabled:opacity-30"
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
                className={`w-20 ${field}`}
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
        className="rounded-lg bg-[var(--ink-accent)] px-4 py-2 font-semibold text-white disabled:opacity-40"
      >
        Lock in
      </button>
    </form>
  )
}

/**
 * Shows the 5 rooms as cards: finished ones with the crowd answer and points, the open one with its question.
 */
export default function HeadcountPlay({ puzzle }: { puzzle: Party }) {
  const key = runKey('headcount', puzzle.date, puzzle.date)
  // DailyGame mounts this only in the browser, after the puzzle loads, and remounts it per day, so the saved run
  // can be read once here.
  const [moves, setMoves] = useState<Guess[]>(() => {
    try {
      const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(v) &&
        v.length <= 5 &&
        v.every((g, i) => Array.isArray(g) && roomPoints(puzzle.questions[i]!, g) !== null)
        ? (v as Guess[])
        : []
    } catch {
      return []
    }
  })
  const [reveal, setReveal] = useState(false)
  const [notice, setNotice] = useState('')
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
  /** Describes what the crowd answered, shown once a room is locked in. */
  const crowd = (question: Question) =>
    question.type === 'typical'
      ? 'Median: ' + question.median + ' ' + (question.unit ?? '')
      : question.options.map((o, i) => o + ' ' + question.crowd[i] + '%').join(' · ')
  return (
    <div className="mx-auto max-w-3xl space-y-3" data-testid="headcount-party">
      <div className="flex items-center justify-between rounded-xl bg-[var(--ink-paper)] px-4 py-3">
        <span className="font-semibold">Party #{puzzle.number}</span>
        <span className="tabular-nums" data-testid="headcount-total">
          {total}/100
        </span>
      </div>
      {rooms.map((room, i) => {
        const question = puzzle.questions[i]!
        const active = i === index && !!q
        const locked = i < moves.length
        return (
          <section
            key={room}
            aria-label={room}
            className={card}
            style={{ borderColor: active ? 'var(--ink-accent)' : 'var(--ink-border)' }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-muted)' }}>
                {room}
              </p>
              {locked && <strong className="tabular-nums">{points[i]}/20</strong>}
            </div>
            {active && !reveal ? (
              <div className="mt-2">
                <Room
                  key={index}
                  q={question}
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
                      logResult('headcount', total + roomPoints(question, guess)!, 5, puzzle.date, {
                        moves: next,
                        sourceDate: puzzle.date,
                      })
                  }}
                />
              </div>
            ) : locked ? (
              <div className="mt-1 space-y-1">
                <h2 className="font-semibold">{question.text}</h2>
                <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                  {crowd(question)}
                </p>
                {active && reveal && (
                  <button
                    type="button"
                    className="mt-2 rounded-lg bg-[var(--ink-accent)] px-4 py-2 font-semibold text-white"
                    onClick={() => setReveal(false)}
                  >
                    {index === 4 ? 'See result' : 'Next room'}
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
                Opens after the room before it.
              </p>
            )}
          </section>
        )
      })}
      {!q && (
        <div className={`${card} space-y-2 text-center`} style={{ borderColor: 'var(--ink-border)' }}>
          <p className="text-xl font-bold">{total}/100</p>
          <p className="text-2xl">{share.split('\n')[1]}</p>
          <button
            type="button"
            className="rounded-lg bg-[var(--ink-accent)] px-4 py-2 font-semibold text-white"
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
      <p role="status" className="text-sm">
        {notice}
      </p>
    </div>
  )
}
