'use client'

/** Renders a past sfjc.dev-bank Orbs edition, or 1 of its categories, as unranked practice. */

import { gridKey } from '@/lib/keyboard'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import {
  ORBS_CATEGORIES,
  ORBS_FORMATS,
  isOrbsCategory,
  orbsWrittenPick,
  type OrbsCategory,
  type OrbsCategoryId,
  type OrbsPick,
  type OrbsPuzzle,
  type OrbsQuestion,
} from '@/lib/orbs'
import { ORBS_LIVES, replayOrbsRound, type OrbsRoundMoves, type OrbsRoundState } from '@/lib/orbs-run'
import { readOrbsArchive, saveOrbsArchive } from '@/lib/orbs-storage'

type Props = { puzzle: OrbsPuzzle; dailyDay: string; category?: OrbsCategoryId }
type Answer = (clue: number, pick: OrbsPick) => boolean | undefined

const colors: Record<OrbsCategoryId, string> = {
  trivia: 'border-amber-500 text-amber-900',
  words: 'border-fuchsia-500 text-fuchsia-900',
  geography: 'border-sky-500 text-sky-900',
  science: 'border-teal-500 text-teal-900',
}
const action =
  'min-h-11 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-left text-sm font-semibold ' +
  'hover:border-[var(--ink-accent)] focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] disabled:opacity-45'

/** Shows earned orbs and remaining lives together, including their screen-reader equivalents. */
function Counters({ category, state }: { category: OrbsCategory; state: OrbsRoundState }) {
  return (
    <div className={`shrink-0 space-y-1 text-right ${colors[category.id]}`}>
      <div
        aria-label={`${state.score} of ${category.questions.length} orbs`}
        role="img"
        className="flex justify-end gap-1.5"
      >
        {category.questions.map((_, index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-full border-2 border-current sm:h-3.5 sm:w-3.5 ${index < state.score ? 'bg-current' : ''}`}
          />
        ))}
      </div>
      <div
        aria-label={`${state.lives} of ${ORBS_LIVES} lives`}
        role="img"
        className="flex justify-end gap-1 text-sm leading-none"
      >
        {Array.from({ length: ORBS_LIVES }, (_, index) => (
          <span key={index} aria-hidden="true" className={index < state.lives ? '' : 'opacity-30'}>
            {index < state.lives ? '♥' : '♡'}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Uses one tap on each side to submit a pair, with either side available as the first tap. */
function MatchBoard({ category, state, answer }: { category: OrbsCategory; state: OrbsRoundState; answer: Answer }) {
  const [selected, setSelected] = useState<{ side: 'clue' | 'label'; index: number } | null>(null)
  const labels = category.questions[0]?.options ?? []
  const used = new Set(state.locked.filter((pick, index) => pick === category.questions[index]?.answer))

  /** Highlights one tile or commits a pair when the other side is already selected. */
  function tap(side: 'clue' | 'label', index: number) {
    if (!selected || selected.side === side) {
      setSelected(selected?.side === side && selected.index === index ? null : { side, index })
      return
    }
    const clue = side === 'clue' ? index : selected.index
    const label = side === 'label' ? index : selected.index
    answer(clue, label as OrbsPick)
    setSelected(null)
  }

  const tile = `${action} w-full aria-pressed:border-[var(--ink-accent)] aria-pressed:bg-[var(--orbs-highlight)]`
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5">
      <section aria-label="Clues" className="min-w-0 space-y-2">
        <h3 className="text-sm font-semibold text-[var(--ink-muted)]">Clues</h3>
        {category.questions.map((question, index) => {
          const locked = state.locked[index] != null
          const solved = state.locked[index] === question.answer
          return (
            <div key={question.prompt}>
              <button
                type="button"
                className={tile}
                disabled={state.done || locked}
                data-hotkey={gridKey(index * 2, 2)}
                aria-pressed={selected?.side === 'clue' && selected.index === index}
                onClick={() => tap('clue', index)}
              >
                {question.prompt}
              </button>
              {(locked || state.done) && (
                <p className="mt-1 px-1 text-xs text-[var(--ink-muted)]">
                  {solved ? 'Correct · ' : 'Answer · '}
                  {question.options[question.answer]}
                </p>
              )}
            </div>
          )
        })}
      </section>
      <section aria-label="Matches" className="min-w-0 space-y-2">
        <h3 className="text-sm font-semibold text-[var(--ink-muted)]">Matches</h3>
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            className={tile}
            disabled={state.done || used.has(index as OrbsPick)}
            data-hotkey={gridKey(index * 2 + 1, 2)}
            aria-pressed={selected?.side === 'label' && selected.index === index}
            onClick={() => tap('label', index)}
          >
            {label}
          </button>
        ))}
      </section>
    </div>
  )
}

/** Renders a written, sorting, or quick-quiz clue. */
function Clue({
  question,
  index,
  format,
  pick,
  done,
  answer,
}: {
  question: OrbsQuestion
  index: number
  format: OrbsCategory['format']
  pick: OrbsPick | null
  done: boolean
  answer: Answer
}) {
  const [draft, setDraft] = useState('')
  const id = `orbs-clue-${index}`
  return (
    <div className="space-y-2 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-3 sm:p-4">
      <h3 id={id} className="font-semibold">
        {question.prompt}
      </h3>
      {pick !== null || done ? (
        <p className="text-sm text-[var(--ink-muted)]">
          {pick === question.answer ? 'Correct · ' : 'Answer · '}
          {question.options[question.answer]}
        </p>
      ) : format === 'type' ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!draft.trim()) return
            answer(index, orbsWrittenPick(question, draft))
            setDraft('')
          }}
        >
          <input
            aria-labelledby={id}
            autoComplete="off"
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your answer"
            className={`${action} min-w-0 flex-1 font-normal`}
          />
          <button type="submit" className={action} disabled={!draft.trim()}>
            Check
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
          {question.options.map((option, pick) => (
            <button
              type="button"
              key={option}
              className={action}
              data-hotkey={pick + 1}
              onClick={() => answer(index, pick as OrbsPick)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Shows just the selected puzzle and reports the result of each move. */
function PuzzleScreen({
  category,
  state,
  answer,
  replay,
}: {
  category: OrbsCategory
  state: OrbsRoundState
  answer: Answer
  replay: (() => void) | undefined
}) {
  const [feedback, setFeedback] = useState('')
  const format = category.format ?? 'choice'
  const judge: Answer = (clue, pick) => {
    const correct = answer(clue, pick)
    if (correct !== undefined) {
      setFeedback(correct ? 'Orb earned.' : state.lives === 1 ? 'No lives left.' : 'One life lost. Try again.')
    }
    return correct
  }
  return (
    <section
      aria-labelledby="orbs-category-title"
      data-arrows="grab"
      className="space-y-4 rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-bg)] p-4 sm:p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--ink-muted)]">{ORBS_FORMATS[format]}</p>
          <h2 id="orbs-category-title" className="text-2xl font-bold">
            {category.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{category.note ?? 'Choose an answer for each clue.'}</p>
        </div>
        <Counters category={category} state={state} />
      </header>
      {format === 'match' ? (
        <MatchBoard category={category} state={state} answer={judge} />
      ) : (
        <div className="space-y-3">
          {category.questions.map((question, index) => (
            <Clue
              key={question.prompt}
              question={question}
              index={index}
              format={format}
              pick={state.locked[index] ?? null}
              done={state.done}
              answer={judge}
            />
          ))}
        </div>
      )}
      <p className="min-h-5 text-sm font-medium text-[var(--ink-accent)]" role="status">
        {feedback ||
          (state.done
            ? `Puzzle complete · ${state.score}/${category.questions.length} orbs`
            : format === 'match'
              ? 'Tap one tile from each column.'
              : '')}
      </p>
      {state.done && replay && (
        <button
          type="button"
          onClick={() => {
            setFeedback('')
            replay()
          }}
          className={action}
          data-hotkey="Enter"
        >
          Play again
        </button>
      )}
    </section>
  )
}

/** Persists answers independently of which screen is open. */
export default function OrbsPlay(props: Props) {
  const { puzzle, dailyDay } = props
  const solo = props.category
  const categories = solo ? puzzle.categories.filter((category) => category.id === solo) : puzzle.categories
  const [moves, setMoves] = useState(() => categories.map((category) => readOrbsArchive(dailyDay, category)))
  const states = categories.map((category, index) => replayOrbsRound(category, moves[index]!)!)
  const complete = states.every((state) => state.done)
  const score = states.reduce((sum, state) => sum + state.score, 0)
  const max = categories.reduce((sum, category) => sum + category.questions.length, 0)

  const path = usePathname()
  const params = useSearchParams()
  const active = params.get('puzzle')
  const selected = categories.find((category) => category.id === (solo ?? (isOrbsCategory(active) ? active : null)))

  /**
   * Keeps the exact edition date when opening or closing a puzzle. These links stay on this page and change only the
   * query, so they skip prefetching: a prefetched same-page link makes the production router ignore the day arrows.
   */
  function href(category?: OrbsCategoryId) {
    const query = new URLSearchParams(params.toString())
    if (category) query.set('puzzle', category)
    else query.delete('puzzle')
    return query.size ? `${path}?${query.toString()}` : path
  }

  /** Records a legal attempt and saves the round's own mark once it ends. */
  const answer: Answer = (clue, pick) => {
    if (!selected) return
    const index = categories.indexOf(selected)
    const current = moves[index]!
    const nextRound = { ...current, attempts: [...current.attempts, { clue, pick }] }
    const nextState = replayOrbsRound(selected, nextRound)
    if (!nextState) return
    const next = moves.map((round, i) => (i === index ? nextRound : round))
    setMoves(next)
    saveOrbsArchive(dailyDay, selected.id, nextRound, nextState.done ? nextState.score : undefined)
    return pick === selected.questions[clue]?.answer
  }

  /** Starts just the active archive puzzle over and keeps its existing archive tick. */
  function replay() {
    if (!selected) return
    const index = categories.indexOf(selected)
    const reset: OrbsRoundMoves = { legacy: [], attempts: [] }
    setMoves(moves.map((round, i) => (i === index ? reset : round)))
    saveOrbsArchive(dailyDay, selected.id, reset)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <section
        aria-label="Orbs progress"
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-paper)] px-4 py-3 sm:px-5"
      >
        <h2 className="font-semibold">
          {selected && !solo ? (
            <Link href={href()} prefetch={false} data-hotkey="Escape" className="underline underline-offset-4">
              ← Back to puzzles
            </Link>
          ) : solo ? (
            'Archive puzzle'
          ) : (
            'Archived edition'
          )}
        </h2>
        <p className="font-semibold tabular-nums" aria-live="polite" data-testid={complete ? 'orbs-result' : undefined}>
          {score}/{max} orbs
        </p>
      </section>
      {selected ? (
        <PuzzleScreen
          key={selected.id}
          category={selected}
          state={states[categories.indexOf(selected)]!}
          answer={answer}
          replay={replay}
        />
      ) : (
        <nav aria-label="Daily Orbs puzzles">
          <ul className="space-y-3" data-arrows="grab">
            {categories.map((category, index) => (
              <li key={category.id}>
                <Link
                  href={href(category.id)}
                  prefetch={false}
                  data-hotkey={index + 1}
                  className={`flex min-h-24 items-start justify-between gap-3 rounded-2xl border border-l-4 bg-[var(--ink-bg)] px-4 py-3 hover:bg-[var(--ink-paper)] sm:px-5 ${colors[category.id]}`}
                >
                  <div className="min-w-0 text-[var(--ink-text)]">
                    <p className="text-xs font-medium text-[var(--ink-muted)]">
                      {ORBS_CATEGORIES[category.id]} · {ORBS_FORMATS[category.format ?? 'choice']}
                    </p>
                    <h3 className="text-lg font-bold sm:text-xl">{category.title}</h3>
                    {category.note && <p className="text-sm text-[var(--ink-muted)]">{category.note}</p>}
                  </div>
                  <Counters category={category} state={states[index]!} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
