'use client'

/**
 * Plays the publisher's 4 Daily Orbs puzzles for a date. Every attempt is kept, so a finished day is sent to the
 * boards and the server replays it for the score.
 */

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import DayNav, { action } from '@/components/daily/DayNav'
import PublisherOrbsText from '@/components/daily/PublisherOrbsText'
import { validDay } from '@/lib/daily'
import { GAME_KEYS } from '@/lib/game-keys'
import { useSiteDay } from '@/lib/play-day'
import {
  answerText,
  ORB_COLORS,
  ORB_LIVES,
  orbsDone,
  orbsOrbCount,
  playOrbs,
  PUBLISHER_ORBS_FIRST_DAY,
  PUBLISHER_ORBS_RANKED_FROM,
  replayOrbs,
  type OrbColor,
  type OrbsMove,
  type OrbsMoves,
  type OrbsRun,
  type PublisherOrbsEdition,
  type PublisherPuzzle,
} from '@/lib/publisher-orbs'
import { GAMES, getPlayer, logResult } from '@/lib/results'

const path = '/games/orbs'
const colors: Record<OrbColor, string> = {
  orange: 'border-t-orange-500 text-orange-700 dark:text-orange-300',
  green: 'border-t-emerald-500 text-emerald-700 dark:text-emerald-300',
  blue: 'border-t-sky-500 text-sky-700 dark:text-sky-300',
  purple: 'border-t-violet-500 text-violet-700 dark:text-violet-300',
}
const tile = 'w-full min-h-11 rounded-xl border bg-[var(--ink-paper)] p-2 text-sm sm:p-3 sm:text-base'
const panel = 'rounded-xl border border-[var(--ink-border)] p-3 sm:p-4'
type Check = (move: OrbsMove) => void
type Progress = OrbsRun

const editionHref = (day: string, color?: OrbColor) => path + '?d=' + day + (color ? '&puzzle=' + color : '')

function ProgressMarks({ puzzle, progress }: { puzzle: PublisherPuzzle; progress: Progress }) {
  const orbs = orbsOrbCount(puzzle, progress.correct.length)
  const remaining = ORB_LIVES - progress.misses
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-lg leading-none">
      <span role="img" aria-label={orbs + ' of 3 orbs'}>
        {'●'.repeat(orbs) + '○'.repeat(3 - orbs)}
      </span>
      {puzzle.type !== 'long-list' && (
        <span role="img" aria-label={remaining + ' of 3 lives'}>
          {'♥'.repeat(remaining) + '♡'.repeat(ORB_LIVES - remaining)}
        </span>
      )}
    </span>
  )
}

function loadProgress(key: string): Progress {
  try {
    const run = JSON.parse(localStorage.getItem(key) ?? 'null') as Progress | null
    if (run && Array.isArray(run.correct) && Number.isInteger(run.misses) && run.misses >= 0 && run.misses <= ORB_LIVES)
      return run
  } catch {}
  return { correct: [], misses: 0, moves: [] }
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
    check(side === 'itemA' ? [text, selection.text] : [selection.text, text])
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4" data-arrows="grab">
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
  note,
}: {
  puzzle: Extract<PublisherPuzzle, { type: 'categorization' }>
  correct: string[]
  check: Check
  note: (message: string) => void
}) {
  const [selected, select] = useState<string>()
  const remaining = puzzle.items.filter((item) => !correct.includes(item.id))
  const item = remaining.find((item) => item.id === selected)
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4" data-arrows="grab">
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
              if (!item) return note('Choose an item first.')
              if (item.category === category) select(undefined)
              check([item.id, category])
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
    if (puzzle.type !== 'themed') check([input])
    else if (clue) check([clue.id, input])
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
  const { correct } = progress
  const done = orbsDone(puzzle, progress)

  function check(move: OrbsMove) {
    const next = playOrbs(puzzle, progress, move)
    if (!next) return
    setFeedback(next.message)
    if (next.run !== progress) save(next.run)
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
          {progress.misses >= ORB_LIVES ? 'Out of lives' : progress.ended ? 'Round ended' : 'Round complete'} ·{' '}
          {correct.length} correct
        </p>
      ) : (
        <>
          {puzzle.type === 'bijection' ? (
            <Matching puzzle={puzzle} correct={correct} check={check} />
          ) : puzzle.type === 'categorization' ? (
            <Sorting puzzle={puzzle} correct={correct} check={check} note={setFeedback} />
          ) : (
            <Written puzzle={puzzle} correct={correct} check={check} />
          )}
          <p role="status" className="min-h-6 text-sm text-[var(--ink-muted)]">
            {feedback && <PublisherOrbsText text={feedback} />}
          </p>
          {puzzle.type === 'long-list' && (
            <button type="button" className={action + ' border border-[var(--ink-border)]'} onClick={() => check([])}>
              End round
            </button>
          )}
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
  const [notice, setNotice] = useState('')
  const untouched = ORB_COLORS.every((slot) => !progress[slot].correct.length && !progress[slot].misses)
  const finished = ORB_COLORS.every((slot) => orbsDone(playable[slot], progress[slot]))
  const ranked = day >= PUBLISHER_ORBS_RANKED_FROM && ORB_COLORS.every((slot) => progress[slot].moves)
  const orbs = (slot: OrbColor) => orbsOrbCount(playable[slot], progress[slot].correct.length)
  const total = ORB_COLORS.reduce((sum, slot) => sum + orbs(slot), 0)
  const share =
    'Daily Orbs · ' +
    day +
    '\n' +
    ORB_COLORS.map((slot) => '●'.repeat(orbs(slot)) + '○'.repeat(3 - orbs(slot))).join(' ') +
    '\n' +
    total +
    '/' +
    GAMES.orbs.max +
    ' · sfjc.dev'

  // Stores the changed rounds only, so a round synced from another device is not overwritten by this page's older
  // copy. Once all 4 are over, sends the day's attempts for the server to replay.
  function saveAll(next: Record<OrbColor, Progress>, changed: readonly OrbColor[] = ORB_COLORS, send = true) {
    setProgress(next)
    for (const slot of changed)
      try {
        localStorage.setItem(storageKey(slot), JSON.stringify(next[slot]))
      } catch {}
    if (!send || day < PUBLISHER_ORBS_RANKED_FROM || !ORB_COLORS.every((slot) => orbsDone(playable[slot], next[slot])))
      return
    const moves = Object.fromEntries(ORB_COLORS.map((slot) => [slot, next[slot].moves])) as Partial<OrbsMoves>
    if (!ORB_COLORS.every((slot) => moves[slot])) return
    const score = ORB_COLORS.reduce((sum, slot) => sum + orbsOrbCount(playable[slot], next[slot].correct.length), 0)
    logResult('orbs', score, score, day, { moves, solved: score === GAMES.orbs.max, sourceDate: day })
  }

  // A day this player finished on another device opens on that run.
  useEffect(() => {
    const player = getPlayer()
    if (!player || !untouched || day < PUBLISHER_ORBS_RANKED_FROM) return
    const controller = new AbortController()
    void fetch('/api/results/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ group: player.group, name: player.name, game: 'orbs', day }),
    })
      .then((response) => (response.ok ? (response.json() as Promise<{ result: { moves?: OrbsMoves } | null }>) : null))
      .then((saved) => {
        const moves = saved?.result?.moves
        // A round started here while the lookup was out keeps this device's run.
        if (!moves || ORB_COLORS.some((slot) => loadProgress(storageKey(slot)).moves?.length)) return
        const runs = ORB_COLORS.map((slot) => replayOrbs(playable[slot], moves[slot] ?? []))
        if (runs.every((run, i) => run && orbsDone(playable[ORB_COLORS[i]!], run)))
          saveAll(
            Object.fromEntries(ORB_COLORS.map((slot, i) => [slot, runs[i]])) as Record<OrbColor, Progress>,
            ORB_COLORS,
            false,
          )
      })
      .catch(() => {})
    return () => controller.abort()
    // Runs once per edition: a player who has started here keeps this device's run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  if (color)
    return (
      <>
        <Link
          className="inline-block py-2 text-sm font-semibold underline"
          href={editionHref(day)}
          prefetch={false}
          data-hotkey="Escape"
        >
          ← All four puzzles
        </Link>
        <Round
          key={color}
          puzzle={playable[color]}
          color={color}
          progress={progress[color]}
          save={(next) => saveAll({ ...progress, [color]: next }, [color])}
        />
      </>
    )
  return (
    <nav aria-label="Publisher Orbs puzzles" className="space-y-3" data-arrows="grab">
      {edition.originalDate && edition.originalDate !== day && (
        <p className="text-sm text-[var(--ink-muted)]">Originally published {edition.originalDate}</p>
      )}
      {finished && (
        <div className={panel + ' space-y-2 bg-[var(--ink-paper)] text-center'}>
          <h2 className="text-xl font-bold" data-testid="orbs-result">
            {total}/{GAMES.orbs.max} orbs
          </h2>
          <p className="text-sm text-[var(--ink-muted)]">
            {ranked ? 'Saved to your daily scores' : 'Practice · not ranked'}
          </p>
          <button
            type="button"
            className={action + ' border border-[var(--ink-border)]'}
            data-hotkey="s"
            onClick={() =>
              navigator.clipboard.writeText(share).then(
                () => setNotice('Result copied.'),
                () => setNotice(share),
              )
            }
          >
            Copy result
          </button>
          <p role="status" className="min-h-5 text-sm whitespace-pre-line text-[var(--ink-muted)]">
            {notice}
          </p>
        </div>
      )}
      {ORB_COLORS.map((slot, i) => (
        <Link
          key={slot}
          href={editionHref(day, slot)}
          prefetch={false}
          data-hotkey={String(i + 1)}
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
        keys={GAME_KEYS.orbs}
        info={
          <>
            <p>Pick any puzzle. Tap two tiles to match them, choose a category, or type your answer.</p>
            <p>Correct answers earn orbs. Most rounds give you three lives. Long lists allow unlimited guesses.</p>
            <p style={{ color: 'var(--ink-muted)' }}>Scoring: {GAMES.orbs.rules}</p>
            <p style={{ color: 'var(--ink-muted)' }}>Everyone gets the same puzzle each day (Pacific time).</p>
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
      </DayNav>
      {day && <LoadEdition key={day} day={day} color={color} />}
    </div>
  )
}
