'use client'

/** Plays four independent Orbs puzzles, or one unranked archive round. */

import { useState } from 'react'
import { orbsRunKey } from '@/lib/daily/saved-run'
import {
  ORBS_CATEGORIES,
  ORBS_CATEGORY_SIZE,
  ORBS_FORMATS,
  ORBS_MAX,
  orbsWrittenPick,
  scoreOrbs,
  type OrbsCategory,
  type OrbsCategoryId,
  type OrbsPick,
  type OrbsPuzzle,
  type OrbsQuestion,
} from '@/lib/orbs'
import { readOrbsPicks, saveArchiveRound, validOrbsPicks } from '@/lib/orbs-storage'
import { isPracticeResult, logResult, markPracticeIfFuture } from '@/lib/results'

type Props = { puzzle: OrbsPuzzle; dailyDay: string } & (
  { mode?: 'daily'; category?: never } | { mode: 'archive'; category: OrbsCategoryId }
)

const categoryColor: Record<OrbsCategoryId, string> = {
  trivia: 'bg-rose-100 text-rose-900',
  words: 'bg-violet-100 text-violet-900',
  geography: 'bg-sky-100 text-sky-900',
  science: 'bg-emerald-100 text-emerald-900',
}
const card = 'rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-bg)]'
const optionStyle =
  'min-h-10 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-1.5 text-left text-sm font-medium hover:border-[var(--ink-accent)] focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] disabled:opacity-45'

/** Renders the appropriate input for a single clue and announces the answer when locked. */
function Clue({
  question,
  format,
  id,
  pick,
  used,
  answer,
}: {
  question: OrbsQuestion
  format: NonNullable<OrbsCategory['format']>
  id: string
  pick: OrbsPick | null
  used: (OrbsPick | null)[]
  answer: (choice: OrbsPick) => void
}) {
  const [draft, setDraft] = useState('')
  const [match, setMatch] = useState('')
  const locked = pick !== null
  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-3 sm:p-4">
      <h3 id={id} className="font-semibold">
        {question.prompt}
      </h3>
      <div aria-live="polite" className="text-sm">
        {locked && (
          <p className={pick === question.answer ? 'text-emerald-800' : 'text-rose-800'}>
            {pick === question.answer ? 'Correct · ' : 'Answer · '}
            {question.options[question.answer]}
          </p>
        )}
      </div>
      {!locked && format === 'type' && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (draft.trim()) answer(orbsWrittenPick(question, draft))
          }}
        >
          <input
            aria-labelledby={id}
            autoComplete="off"
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your answer"
            className={`${optionStyle} min-w-0 flex-1`}
          />
          <button type="submit" className={optionStyle} disabled={!draft.trim()}>
            Check
          </button>
        </form>
      )}
      {!locked && format === 'match' && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (match !== '' && !used.includes(Number(match) as OrbsPick)) answer(Number(match) as OrbsPick)
          }}
        >
          <select
            aria-labelledby={id}
            value={match}
            onChange={(event) => setMatch(event.target.value)}
            className={`${optionStyle} min-w-0 flex-1`}
          >
            <option value="">Choose a match</option>
            {question.options.map((label, option) => (
              <option value={option} key={label} disabled={used.includes(option as OrbsPick)}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className={optionStyle}
            disabled={match === '' || used.includes(Number(match) as OrbsPick)}
          >
            Match
          </button>
        </form>
      )}
      {!locked && (format === 'choice' || format === 'sort') && (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
          {question.options.map((label, option) => (
            <button type="button" key={label} className={optionStyle} onClick={() => answer(option as OrbsPick)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Lets players jump between puzzles and preserves both old sequential and new out-of-order runs. */
export default function OrbsPlay(props: Props) {
  const { puzzle, dailyDay } = props
  const archive = props.mode === 'archive'
  const categories = archive ? puzzle.categories.filter((item) => item.id === props.category) : puzzle.categories
  const questions = categories.flatMap((category) => category.questions)
  const key = orbsRunKey(dailyDay)
  const [picks, setPicks] = useState(() => {
    const saved = archive ? [] : readOrbsPicks(key)
    return questions.map((_, index) => saved[index] ?? null)
  })
  const [active, setActive] = useState(() => {
    const firstPending = picks.indexOf(null)
    const category = categories.find(
      (_, index) => firstPending >= index * ORBS_CATEGORY_SIZE && firstPending < (index + 1) * ORBS_CATEGORY_SIZE,
    )
    return category?.id ?? categories[0]?.id
  })
  const completed = picks.every((pick) => pick !== null)
  const score = scoreOrbs(questions, picks)
  const selected = categories.find((category) => category.id === active)
  const offset = selected ? categories.indexOf(selected) * ORBS_CATEGORY_SIZE : 0
  const format = selected?.format ?? 'choice'

  /** Saves the pick immediately and records a result only once all required clues are answered. */
  function answer(index: number, option: OrbsPick) {
    if (picks[index] !== null) return
    const next = picks.map((previous, i) => (i === index ? option : previous))
    setPicks(next)
    if (props.mode === 'archive') {
      if (next.every((pick) => pick !== null)) saveArchiveRound(dailyDay, props.category, scoreOrbs(questions, next))
      return
    }
    markPracticeIfFuture('orbs', dailyDay)
    try {
      localStorage.setItem(key, JSON.stringify({ picks: next }))
    } catch {
      // The current run remains playable when storage is unavailable.
    }
    if (next.length === ORBS_MAX && validOrbsPicks(next)) {
      const earned = scoreOrbs(questions, next)
      logResult('orbs', earned, earned, dailyDay, { moves: next, solved: earned === ORBS_MAX })
    }
  }

  if (!selected) return null

  return (
    <div className="space-y-4">
      <section
        aria-label="Orbs progress"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--orbs-strip)] px-4 py-3 text-[var(--orbs-strip-text)] sm:px-5"
      >
        <div>
          <h2 className="text-xl font-bold">{archive ? 'Archive round' : 'Daily puzzle board'}</h2>
          <p className="text-sm opacity-85">
            {completed
              ? archive
                ? 'Archive round complete'
                : isPracticeResult('orbs', dailyDay)
                  ? 'Practice complete'
                  : 'Daily complete'
              : archive
                ? ORBS_CATEGORIES[selected.id]
                : 'Pick a puzzle to start.'}
          </p>
        </div>
        <p
          className="text-lg font-semibold tabular-nums"
          data-testid={completed ? 'orbs-result' : undefined}
          aria-live="polite"
        >
          {score}/{questions.length} orbs
        </p>
      </section>
      <div className={archive ? '' : 'grid gap-4 md:grid-cols-[minmax(13rem,0.85fr)_minmax(0,1.8fr)]'}>
        {!archive && (
          <nav aria-label="Daily Orbs puzzles" className="grid grid-cols-2 gap-2 self-start md:grid-cols-1">
            {categories.map((category, index) => {
              const categoryPicks = picks.slice(index * ORBS_CATEGORY_SIZE, (index + 1) * ORBS_CATEGORY_SIZE)
              const done = categoryPicks.every((pick) => pick !== null)
              const found = scoreOrbs(category.questions, categoryPicks)
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={category.id === active}
                  aria-controls="orbs-current-puzzle"
                  className={`${card} flex min-h-24 min-w-0 flex-col items-start gap-1 px-3 py-2.5 text-left hover:border-[var(--ink-accent)] aria-pressed:border-[var(--ink-accent)] aria-pressed:ring-1 aria-pressed:ring-[var(--ink-accent)]`}
                  onClick={() => setActive(category.id)}
                >
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor[category.id]}`}>
                    {ORBS_CATEGORIES[category.id]}
                  </span>
                  <span className="text-sm leading-tight font-bold sm:text-base">{category.title}</span>
                  <span className="text-xs text-[var(--ink-muted)]">
                    {done ? `${found}/${category.questions.length} orbs` : ORBS_FORMATS[category.format ?? 'choice']}
                  </span>
                </button>
              )
            })}
          </nav>
        )}
        <section
          id="orbs-current-puzzle"
          aria-labelledby="orbs-category-title"
          className={`${card} space-y-3 p-3 sm:p-5`}
        >
          <header>
            <p className="text-xs font-semibold text-[var(--ink-accent)]">{ORBS_FORMATS[format]}</p>
            <h2 id="orbs-category-title" className="text-xl font-bold sm:text-2xl">
              {selected.title}
            </h2>
            {selected.note && <p className="mt-1 text-sm text-[var(--ink-muted)]">{selected.note}</p>}
          </header>
          {selected.questions.map((question, index) => (
            <Clue
              key={`${selected.id}:${index}`}
              id={`orbs-clue-${index}`}
              question={question}
              format={format}
              pick={picks[offset + index] ?? null}
              used={picks.slice(offset, offset + selected.questions.length)}
              answer={(option) => answer(offset + index, option)}
            />
          ))}
        </section>
      </div>
    </div>
  )
}
