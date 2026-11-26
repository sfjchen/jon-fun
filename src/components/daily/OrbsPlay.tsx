'use client'

/** Plays a ranked Orbs day or one unranked archive category. */

import { useEffect, useRef, useState } from 'react'
import { runKey } from '@/lib/daily/saved-run'
import { ORBS_MAX, scoreOrbs, type OrbsCategoryId, type OrbsPuzzle } from '@/lib/orbs'
import { readOrbsPicks, saveArchiveRound } from '@/lib/orbs-storage'
import { isPracticeResult, logResult, markPracticeIfFuture } from '@/lib/results'

type Props = { puzzle: OrbsPuzzle; dailyDay: string } & (
  { mode?: 'daily'; category?: never } | { mode: 'archive'; category: OrbsCategoryId }
)

/** Shows one question at a time and locks each pick before revealing the answer. */
export default function OrbsPlay(props: Props) {
  const { puzzle, dailyDay } = props
  const archive = props.mode === 'archive'
  const categories = archive ? puzzle.categories.filter((item) => item.id === props.category) : puzzle.categories
  const questions = categories.flatMap((item) =>
    item.questions.map((question) => ({ ...question, category: item.title })),
  )
  const total = questions.length
  const key = runKey('orbs', dailyDay, dailyDay)
  const [picks, setPicks] = useState(() => (archive ? [] : readOrbsPicks(key)))
  const [index, setIndex] = useState(picks.length)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  const question = questions[index]
  const pick = picks[index]
  const score = scoreOrbs(questions, picks)

  useEffect(() => {
    if (moved.current) heading.current?.focus()
  }, [index])

  /** Saves the current pick and records the appropriate result when the final answer lands. */
  function answer(option: number) {
    if (picks.length !== index) return
    const next = [...picks, option]
    setPicks(next)
    if (props.mode === 'archive') {
      if (next.length === total) saveArchiveRound(dailyDay, props.category, scoreOrbs(questions, next))
      return
    }
    if (!index) markPracticeIfFuture('orbs', dailyDay)
    try {
      localStorage.setItem(key, JSON.stringify({ picks: next }))
    } catch {
      // The current run still works when local storage is disabled.
    }
    if (next.length === ORBS_MAX) {
      const earned = scoreOrbs(questions, next)
      logResult('orbs', earned, earned, dailyDay, { moves: next, solved: earned === ORBS_MAX })
    }
  }

  if (!question) {
    return (
      <section className="rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-6 text-center">
        <h2 ref={heading} tabIndex={-1} className="text-3xl font-bold tabular-nums" data-testid="orbs-result">
          {score}/{total} orbs
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          {archive
            ? 'Archive round complete'
            : isPracticeResult('orbs', dailyDay)
              ? 'Practice complete'
              : 'Daily complete'}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-[var(--ink-muted)]">
        <span>
          {question.category} · {index + 1} of {total}
        </span>
        <span className="tabular-nums">
          {score} {score === 1 ? 'orb' : 'orbs'}
        </span>
      </div>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-bold sm:text-2xl">
        {question.prompt}
      </h2>
      <div className="grid gap-2">
        {question.options.map((option, value) => (
          <button
            key={option}
            type="button"
            aria-disabled={pick !== undefined}
            onClick={() => answer(value)}
            className={
              'min-h-11 rounded-xl border px-4 py-2 text-left font-medium ' +
              (pick === undefined
                ? 'border-[var(--ink-border)] bg-[var(--ink-bg)] hover:border-[var(--ink-accent)]'
                : value === question.answer
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                  : value === pick
                    ? 'border-red-700 bg-red-50 text-red-950'
                    : 'border-[var(--ink-border)] text-[var(--ink-muted)]')
            }
          >
            {option}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="text-sm">
        {pick !== undefined &&
          (pick === question.answer ? 'Correct!' : `Correct answer: ${question.options[question.answer]}`)}
      </div>
      {pick !== undefined && (
        <button
          type="button"
          onClick={() => {
            moved.current = true
            setIndex(index + 1)
          }}
          className="min-h-11 rounded-xl bg-[var(--ink-accent)] px-4 py-2 font-semibold text-white hover:opacity-90"
        >
          {index + 1 === total ? 'See result' : 'Next question'}
        </button>
      )}
    </section>
  )
}
