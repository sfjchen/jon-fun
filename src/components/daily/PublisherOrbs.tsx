'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import DayNav, { action } from '@/components/daily/DayNav'
import PublisherOrbsText from '@/components/daily/PublisherOrbsText'
import { validDay } from '@/lib/daily'
import { useSiteDay } from '@/lib/play-day'
import {
  answerText,
  findOrbsAnswer,
  ORB_COLORS,
  orbsOrbCount,
  PUBLISHER_ORBS_FIRST_DAY,
  type OrbColor,
  type PublisherOrbsEdition,
  type PublisherPuzzle,
} from '@/lib/publisher-orbs'

const path = '/games/orbs'
const lives = 3
const colors: Record<OrbColor, string> = {
  orange: 'border-t-orange-500 text-orange-700 dark:text-orange-300',
  green: 'border-t-emerald-500 text-emerald-700 dark:text-emerald-300',
  blue: 'border-t-sky-500 text-sky-700 dark:text-sky-300',
  purple: 'border-t-violet-500 text-violet-700 dark:text-violet-300',
}
const tile = 'w-full min-h-11 rounded-xl border bg-[var(--ink-paper)] p-2 text-sm sm:p-3 sm:text-base'
const panel = 'rounded-xl border border-[var(--ink-border)] p-3 sm:p-4'
type Check = (id: string | null, message: string, neutral?: boolean) => void
type Progress = { correct: string[]; misses: number }

const editionHref = (day: string, color?: OrbColor) => path + '?d=' + day + (color ? '&puzzle=' + color : '')

function ProgressMarks({ puzzle, progress }: { puzzle: PublisherPuzzle; progress: Progress }) {
  const orbs = orbsOrbCount(puzzle, progress.correct.length)
  const remaining = lives - progress.misses
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-lg leading-none">
      <span role="img" aria-label={orbs + ' of 3 orbs'}>
        {'●'.repeat(orbs) + '○'.repeat(3 - orbs)}
      </span>
      {puzzle.type !== 'long-list' && (
        <span role="img" aria-label={remaining + ' of 3 lives'}>
          {'♥'.repeat(remaining) + '♡'.repeat(lives - remaining)}
        </span>
      )}
    </span>
  )
}

function puzzleSize(puzzle: PublisherPuzzle) {
  switch (puzzle.type) {
    case 'bijection':
      return puzzle.pairs.length
    case 'categorization':
      return puzzle.items.length
    case 'themed':
      return puzzle.clues.length
    case 'long-list':
      return Math.min(puzzle.answers.length, puzzle.starThresholds[2])
    case 'open-ended':
      return puzzle.answers.length
  }
}

function loadProgress(key: string): Progress {
  try {
    const run = JSON.parse(localStorage.getItem(key) ?? 'null') as Progress | null
    if (run && Array.isArray(run.correct) && Number.isInteger(run.misses) && run.misses >= 0 && run.misses <= lives)
      return run
  } catch {}
  return { correct: [], misses: 0 }
}

function Tile({ text, selected, onClick }: { text: string; selected?: boolean; onClick: () => void }) {
  return (
    <button
      className={
        tile +
        (selected
          ? ' border-[var(--ink-accent)] ring-2 ring-[var(--ink-accent)]'
          : ' border-[var(--ink-border)] hover:border-[var(--ink-accent)]')
      }
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      <PublisherOrbsText text={text} />
    </button>
  )
}

function Matching({
  puzzle,
  correct,
  check,
}: {
  puzzle: Extract<PublisherPuzzle, { type: 'bijection' }>
  correct: string[]
  check: Check
}) {
  const [selection, select] = useState<{ side: 'itemA' | 'itemB'; text: string }>()
  const remaining = puzzle.pairs.filter((pair) => !correct.includes(pair.id))
  // Independent column order keeps answers from lining up in feed order.
  const left = [
    ...new Set([...remaining].sort((a, b) => (a.sortA ?? Infinity) - (b.sortA ?? Infinity)).map((pair) => pair.itemA)),
  ]
  const right = [
    ...new Set(
      [...remaining]
        .sort((a, b) => (a.sortB ?? Infinity) - (b.sortB ?? Infinity) || a.itemB.localeCompare(b.itemB))
        .map((pair) => pair.itemB),
    ),
  ]

  function tap(side: 'itemA' | 'itemB', text: string) {
    if (!selection || selection.side === side) {
      select(selection?.text === text && selection.side === side ? undefined : { side, text })
      return
    }
    select(undefined)
    const itemA = side === 'itemA' ? text : selection.text
    const itemB = side === 'itemB' ? text : selection.text
    const matches = (pair: { itemA: string; itemB: string }) => pair.itemA === itemA && pair.itemB === itemB
    const pair = remaining.find(matches)
    const neutral = puzzle.neutralPairs?.find(matches)
    const wrong = puzzle.expectedWrong?.find(matches)
    check(
      pair?.id ?? null,
      pair?.display ?? neutral?.display ?? wrong?.display ?? (pair ? 'Match found.' : 'Try a different match.'),
      Boolean(neutral),
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      {(
        [
          { side: 'itemA', title: puzzle.columnA, values: left },
          { side: 'itemB', title: puzzle.columnB, values: right },
        ] as const
      ).map(({ side, title, values }) => (
        <div key={side} className="min-w-0 space-y-2">
          {title && (
            <h3 className="font-semibold">
              <PublisherOrbsText text={title} />
            </h3>
          )}
          {values.map((text) => (
            <Tile
              key={text}
              text={text}
              selected={selection?.side === side && selection.text === text}
              onClick={() => tap(side, text)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Sorting({
  puzzle,
  correct,
  check,
}: {
  puzzle: Extract<PublisherPuzzle, { type: 'categorization' }>
  correct: string[]
  check: Check
}) {
  const [selected, select] = useState<string>()
  const remaining = puzzle.items.filter((item) => !correct.includes(item.id))
  const item = remaining.find((item) => item.id === selected)
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <div className="min-w-0 space-y-2">
        <h3 className="font-semibold">Items</h3>
        {remaining.map((item) => (
          <Tile
            key={item.id}
            text={item.description ? item.text + '\n' + item.description : item.text}
            selected={item.id === selected}
            onClick={() => select(item.id === selected ? undefined : item.id)}
          />
        ))}
      </div>
      <div className="min-w-0 space-y-2">
        <h3 className="font-semibold">Categories</h3>
        {puzzle.categories.map((category) => (
          <Tile
            key={category}
            text={(puzzle.categoryIcons?.[category] ?? '') + ' ' + category}
            onClick={() => {
              if (!item) return check(null, 'Choose an item first.', true)
              const matched = item.category === category
              if (matched) select(undefined)
              check(
                matched ? item.id : null,
                matched ? (item.reveal ?? 'Correct category.') : 'Try a different category.',
              )
            }}
          />
        ))}
      </div>
    </div>
  )
}

function Written({
  puzzle,
  correct,
  check,
}: {
  puzzle: Exclude<PublisherPuzzle, { type: 'bijection' | 'categorization' }>
  correct: string[]
  check: Check
}) {
  const [input, setInput] = useState('')
  const [selected, select] = useState<string>()
  const clues = puzzle.type === 'themed' ? puzzle.clues.filter((clue) => !correct.includes(clue.id)) : []
  const clue = clues.find((clue) => clue.id === selected) ?? clues[0]

  function submit() {
    if (!input.trim()) return
    setInput('')
    if (puzzle.type === 'themed') {
      if (!clue) return
      const found = findOrbsAnswer(input, clue.answers, puzzle)
      const unexpected = clue.expectedWrong ?? []
      const wrong = findOrbsAnswer(input, unexpected, puzzle)
      if (found >= 0) check(clue.id, clue.reveal ?? answerText(clue.answers[found]!))
      else check(null, wrong >= 0 ? answerText(unexpected[wrong]!) : 'Try another answer.')
      return
    }
    const found = findOrbsAnswer(input, puzzle.answers, puzzle)
    const neutral = puzzle.neutralAnswers ?? []
    const wrong = puzzle.expectedWrong ?? []
    const neutralIndex = findOrbsAnswer(input, neutral, puzzle)
    const wrongIndex = findOrbsAnswer(input, wrong, puzzle)
    if (found >= 0) check(String(found), answerText(puzzle.answers[found]!))
    else if (neutralIndex >= 0) check(null, answerText(neutral[neutralIndex]!), true)
    else
      check(
        null,
        wrongIndex >= 0 ? answerText(wrong[wrongIndex]!) : (puzzle.expectedWrongDefault ?? 'Try another answer.'),
      )
  }

  return (
    <div className="space-y-3">
      {clue && (
        <div className={panel + ' space-y-2'}>
          <label className="block text-sm font-semibold" htmlFor="orbs-clue">
            Choose a clue
          </label>
          <select
            id="orbs-clue"
            className="max-w-full rounded-lg border bg-[var(--ink-paper)] px-2 py-1"
            value={clue.id}
            onChange={(event) => select(event.target.value)}
          >
            {clues.map((entry) => (
              <option key={entry.id} value={entry.id}>
                Clue {puzzle.type === 'themed' ? puzzle.clues.indexOf(entry) + 1 : ''}
              </option>
            ))}
          </select>
          <div className="text-lg">
            <PublisherOrbsText text={clue.hint} />
          </div>
        </div>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label className="min-w-0 flex-1 text-sm font-semibold">
          Answer
          <input
            className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--ink-border)] bg-[var(--ink-paper)] px-3"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
            maxLength={200}
            placeholder={puzzle.type === 'themed' ? puzzle.placeholder : undefined}
          />
        </label>
        <button
          type="submit"
          className={action + ' min-h-11 border border-[var(--ink-border)]'}
          disabled={!input.trim()}
        >
          Submit
        </button>
      </form>
    </div>
  )
}

function AnswerList({ puzzle, correct, done }: { puzzle: PublisherPuzzle; correct: string[]; done: boolean }) {
  let answers: { id: string; label: string }[]
  switch (puzzle.type) {
    case 'bijection':
      answers = puzzle.pairs.map((pair) => ({ id: pair.id, label: pair.itemA + ' — ' + pair.itemB }))
      break
    case 'categorization':
      answers = puzzle.items.map((item) => ({ id: item.id, label: item.text + ' — ' + item.category }))
      break
    case 'themed':
      answers = puzzle.clues.map((clue) => ({
        id: clue.id,
        label: clue.hint + ' — ' + clue.answers.map(answerText).join(' / '),
      }))
      break
    default:
      answers = puzzle.answers.map((answer, index) => ({ id: String(index), label: answerText(answer) }))
  }
  if (!done) answers = answers.filter(({ id }) => correct.includes(id))
  if (!answers.length) return null
  return (
    <details className={panel} open={!done}>
      <summary className="cursor-pointer font-semibold">{done ? 'Review answers' : 'Answers found'}</summary>
      <ul className="mt-2 divide-y divide-[var(--ink-border)] text-sm">
        {answers.map(({ id, label }) => (
          <li key={id} className="py-2">
            <PublisherOrbsText text={label} />
          </li>
        ))}
      </ul>
    </details>
  )
}

function Round({
  puzzle,
  color,
  progress,
  save,
}: {
  puzzle: PublisherPuzzle
  color: OrbColor
  progress: Progress
  save: (next: Progress) => void
}) {
  const [feedback, setFeedback] = useState<string>()
  const { correct, misses } = progress
  const complete = correct.length >= puzzleSize(puzzle)
  const done = complete || misses >= lives

  function check(id: string | null, message: string, neutral = false) {
    if (done) return
    if (id !== null && correct.includes(id)) return setFeedback('You already found that answer.')
    setFeedback(message)
    if (id !== null) save({ correct: [...correct, id], misses })
    else if (!neutral && puzzle.type !== 'long-list') save({ correct, misses: misses + 1 })
  }

  return (
    <section className="space-y-3">
      <div className={panel + ' border-t-4 ' + colors[color]}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-lora text-2xl font-bold text-[var(--ink-text)]">{puzzle.title}</h2>
          <ProgressMarks puzzle={puzzle} progress={progress} />
        </div>
        <p className="mt-2 text-[var(--ink-text)]">
          <PublisherOrbsText text={puzzle.description} />
        </p>
        {puzzle.notice && (
          <p className="mt-2 text-sm">
            <PublisherOrbsText text={puzzle.notice} />
          </p>
        )}
      </div>
      {done ? (
        <p role="status" className={panel}>
          {complete ? 'Round complete' : 'Out of lives'} · {correct.length} correct
        </p>
      ) : (
        <>
          {puzzle.type === 'bijection' ? (
            <Matching puzzle={puzzle} correct={correct} check={check} />
          ) : puzzle.type === 'categorization' ? (
            <Sorting puzzle={puzzle} correct={correct} check={check} />
          ) : (
            <Written puzzle={puzzle} correct={correct} check={check} />
          )}
          <p role="status" className="min-h-6 text-sm text-[var(--ink-muted)]">
            {feedback && <PublisherOrbsText text={feedback} />}
          </p>
        </>
      )}
      <AnswerList puzzle={puzzle} correct={correct} done={done} />
      {done && puzzle.explanation && (
        <div className={panel}>
          <PublisherOrbsText text={puzzle.explanation} />
        </div>
      )}
      {puzzle.footnote && (
        <div className="text-sm text-[var(--ink-muted)]">
          <PublisherOrbsText text={puzzle.footnote} />
        </div>
      )}
    </section>
  )
}

function Edition({ edition, color }: { edition: PublisherOrbsEdition; color: OrbColor | undefined }) {
  const { day, playable } = edition
  const storageKey = (slot: OrbColor) => 'sfjc_publisher_orbs:' + day + ':' + slot + ':' + playable[slot].id
  const [progress, setProgress] = useState(
    () =>
      Object.fromEntries(ORB_COLORS.map((slot) => [slot, loadProgress(storageKey(slot))])) as Record<
        OrbColor,
        Progress
      >,
  )
  function save(slot: OrbColor, next: Progress) {
    setProgress((current) => ({ ...current, [slot]: next }))
    try {
      localStorage.setItem(storageKey(slot), JSON.stringify(next))
    } catch {}
  }
  if (color)
    return (
      <>
        <Link className="inline-block py-2 text-sm font-semibold underline" href={editionHref(day)}>
          ← All four puzzles
        </Link>
        <Round
          key={color}
          puzzle={playable[color]}
          color={color}
          progress={progress[color]}
          save={(next) => save(color, next)}
        />
      </>
    )
  return (
    <nav aria-label="Publisher Orbs puzzles" className="space-y-3">
      {edition.originalDate && edition.originalDate !== day && (
        <p className="text-sm text-[var(--ink-muted)]">Originally published {edition.originalDate}</p>
      )}
      {ORB_COLORS.map((slot) => (
        <Link
          key={slot}
          href={editionHref(day, slot)}
          className={panel + ' block border-t-4 bg-[var(--ink-paper)] hover:bg-[var(--ink-bg)] ' + colors[slot]}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-lora text-xl font-bold text-[var(--ink-text)]">{playable[slot].title}</h2>
            <ProgressMarks puzzle={playable[slot]} progress={progress[slot]} />
          </div>
          <p className="mt-1 text-sm text-[var(--ink-text)]">
            <PublisherOrbsText text={playable[slot].description} />
          </p>
        </Link>
      ))}
    </nav>
  )
}

function LoadEdition({ day, color }: { day: string; color: OrbColor | undefined }) {
  const [edition, setEdition] = useState<PublisherOrbsEdition>()
  const [error, setError] = useState(false)
  const [attempt, retry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/orbs/publisher?d=' + day + '&play=1', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load the edition')
        const result = (await response.json()) as PublisherOrbsEdition
        if (result.day !== day || !result.playable) throw new Error('Edition date did not match')
        if (!controller.signal.aborted) setEdition(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [day, attempt])
  if (error)
    return (
      <div className={panel}>
        <p role="alert">Could not load the publisher’s puzzles for {day}.</p>
        <button
          type="button"
          className="mt-2 underline"
          onClick={() => {
            setError(false)
            retry(attempt + 1)
          }}
        >
          Try again
        </button>
      </div>
    )
  return edition ? <Edition edition={edition} color={color} /> : <p role="status">Loading the Daily Orbs edition…</p>
}

export default function PublisherOrbs() {
  const params = useSearchParams()
  const today = useSiteDay()
  const requested = params.get('d')
  const day = validDay(requested) ? requested : today
  const color = ORB_COLORS.find((slot) => slot === params.get('puzzle'))

  return (
    <div className="daily-game mx-auto w-full max-w-3xl" data-testid="publisher-orbs">
      <DayNav
        title="Daily Orbs"
        path={path}
        day={day || undefined}
        publishedOnly
        minDay={PUBLISHER_ORBS_FIRST_DAY}
        info={
          <>
            <p>Pick any puzzle. Tap two tiles to match them, choose a category, or type your answer.</p>
            <p>Correct answers earn orbs. Most rounds give you three lives. Long lists allow unlimited guesses.</p>
            <p>Publisher edition progress is saved on this device.</p>
            <p>
              Puzzles by{' '}
              <a className="underline" href="https://dailyorbs.com">
                Daily Orbs
              </a>
              .
            </p>
          </>
        }
      >
        <Link className={action} href="/games/orbs/archive">
          Archive
        </Link>
        <Link className={action} href={'/games/orbs/local' + (day && day !== today ? '?d=' + day : '')}>
          Ranked Orbs
        </Link>
      </DayNav>
      {day && <LoadEdition key={day} day={day} color={color} />}
    </div>
  )
}
