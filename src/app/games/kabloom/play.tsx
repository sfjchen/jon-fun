'use client'

/**
 * Kabloom player: a 7-round climb up the volcano. Each round shows its prompt for the edition's reading clock, then
 * gives the answer clock to name an accepted answer. Rejected answers can be retried while the clock runs, each
 * answer can be used once in a climb, and a close misspelling comes back as a suggestion to send again. The run is
 * stored on wall time, so a reload resumes the same clock and never grants a new one. The climb ends at the summit
 * or when a clock runs out, and the cleared rounds go to the server, which replays them for the score.
 */

import { useEffect, useRef, useState } from 'react'
import { runKey } from '@/lib/daily/saved-run'
import { logResult } from '@/lib/results'
import { judgeKabloom, kabloomClock, KABLOOM_ROUNDS, type KabloomPuzzle, type KabloomRun } from '@/lib/kabloom'

/**
 * Reads a stored run, or a fresh one when none is stored or it does not have the run's shape.
 */
function restore(key: string): KabloomRun {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<KabloomRun> | null
    if (
      Array.isArray(v?.moves) &&
      v.moves.every((m) => typeof m?.id === 'string' && Number.isInteger(m.ms)) &&
      (v.start === null || Number.isFinite(v.start)) &&
      typeof v.over === 'boolean'
    )
      return v as KabloomRun
  } catch {}
  return { moves: [], start: null, over: false }
}

/**
 * Stores a run and sends the result once the climb ends. Reports false when this browser cannot store it.
 */
function persist(key: string, run: KabloomRun, day: string, puzzle: KabloomPuzzle): boolean {
  if (run.over)
    logResult('kabloom', run.moves.length, run.moves.length, day, {
      moves: run.moves,
      solved: run.moves.length === KABLOOM_ROUNDS,
      sourceDate: puzzle.date,
      puzzleId: String(puzzle.editionId),
      max: KABLOOM_ROUNDS,
    })
  try {
    localStorage.setItem(key, JSON.stringify(run))
    return true
  } catch {
    return false
  }
}

/**
 * Renders the climb for a day's edition, from the start screen through the end card.
 */
export default function KabloomPlay({ puzzle, dailyDay }: { puzzle: KabloomPuzzle; dailyDay: string }) {
  const key = runKey('kabloom', dailyDay, dailyDay)
  const [run, setRun] = useState(() => restore(key))
  const [now, setNow] = useState(() => Date.now())
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [hint, setHint] = useState<{ text: string; label: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const round = run.moves.length
  const clock = run.start === null ? null : kabloomClock(puzzle, run.start, now)
  const answering = !run.over && !!clock && clock.reading === 0 && clock.left > 0
  const label = (id: string) => puzzle.answers.find((a) => a.id === id)?.label ?? id

  /** Shows and stores the run. */
  function save(next: KabloomRun) {
    setRun(next)
    if (!persist(key, next, dailyDay, puzzle)) setNote('Progress is available only in this tab.')
  }

  // The clock ticks on wall time while a round is open and ends the climb when the answer clock runs out.
  useEffect(() => {
    const start = run.start
    if (start === null || run.over) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (kabloomClock(puzzle, start, t).left > 0) return
      const next = { ...run, over: true }
      setRun(next)
      setHint(null)
      setNote('Time ran out.')
      persist(key, next, dailyDay, puzzle)
    }, 100)
    return () => clearInterval(id)
  }, [run, puzzle, key, dailyDay])

  useEffect(() => {
    if (answering) input.current?.focus()
  }, [answering, round])

  /** Judges an answer for the open round: clears it, or explains why not and leaves the clock running. */
  function send(text: string, confirm: boolean) {
    if (!answering || run.start === null || !text.trim()) return
    const v = judgeKabloom(
      puzzle,
      round,
      run.moves.map((m) => m.id),
      text,
      confirm,
    )
    setHint(null)
    if (v.kind === 'suggest') {
      setHint({ text: text.trim(), label: v.label })
      return setNote(`Did you mean ${v.label}? Send it again to confirm.`)
    }
    if (v.kind !== 'clear') {
      input.current?.select()
      return setNote(v.kind === 'spent' ? `${label(v.id)} is already used.` : 'Not this one. Try again.')
    }
    const t = Date.now()
    const moves = [...run.moves, { id: v.id, ms: Math.min(puzzle.answerMs, t - run.start - puzzle.readingMs) }]
    const summit = moves.length === KABLOOM_ROUNDS
    setDraft('')
    setNow(t)
    setNote(`${label(v.id)} clears round ${moves.length}.`)
    save({ moves, start: summit ? null : t, over: summit })
  }

  const cleared = run.moves.length
  const share =
    `Kabloom · ${puzzle.date}\n` +
    '🟩'.repeat(cleared) +
    (cleared < KABLOOM_ROUNDS ? '💥' + '⬜'.repeat(KABLOOM_ROUNDS - cleared - 1) : '🌋') +
    `\n${cleared}/${KABLOOM_ROUNDS} · sfjc.dev/games/kabloom`
  const card = 'rounded-xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-4 sm:p-5'
  const button = 'rounded-full bg-[var(--game-color)] px-5 py-2 font-semibold text-white disabled:opacity-50'
  const prompt = puzzle.rounds[round]
  return (
    <section className="mx-auto w-full max-w-xl space-y-3" data-testid="kabloom-play">
      <div className={`${card} flex items-center gap-4`}>
        <svg
          viewBox="0 0 120 100"
          className="h-24 w-28 shrink-0"
          role="img"
          aria-label={`${cleared} of ${KABLOOM_ROUNDS} rounds climbed`}
        >
          {run.over && cleared < KABLOOM_ROUNDS && (
            <g className="kabloom-erupt" fill="var(--game-color)">
              <circle cx="52" cy="10" r="7" />
              <circle cx="64" cy="6" r="6" />
              <circle cx="72" cy="13" r="5" />
            </g>
          )}
          <path d="M8 95 46 18h28l38 77Z" fill="var(--ink-bg)" stroke="var(--ink-text)" strokeWidth="2.4" />
          {puzzle.rounds.map((_, i) => (
            <line
              key={i}
              x1={44 - (6 - i) * 5}
              x2={76 + (6 - i) * 5}
              y1={84 - i * 10}
              y2={84 - i * 10}
              stroke={i < cleared ? 'var(--game-color)' : 'var(--ink-border)'}
              strokeWidth="2.4"
            />
          ))}
          {cleared === KABLOOM_ROUNDS && (
            <path d="M60 18V4l10 4-10 4" fill="var(--game-color)" stroke="var(--ink-text)" />
          )}
          <circle
            className="kabloom-climber"
            cx="60"
            cy="0"
            r="4"
            fill="var(--ink-text)"
            style={{ transform: `translateY(${cleared ? 84 - (cleared - 1) * 10 - 5 : 92}px)` }}
          />
        </svg>
        <div className="min-w-0">
          <p className="text-sm text-[var(--ink-muted)]">{puzzle.category}</p>
          <p className="font-semibold">
            {run.over
              ? 'Climb over'
              : run.start === null
                ? 'Ready to climb'
                : `Round ${round + 1} of ${KABLOOM_ROUNDS}`}
          </p>
          <p className="tabular-nums" data-testid={run.over ? 'kabloom-result' : undefined}>
            {cleared}/{KABLOOM_ROUNDS} cleared
          </p>
        </div>
      </div>

      {run.start === null && !run.over && (
        <div className={`${card} space-y-3 text-center`}>
          <p>
            {KABLOOM_ROUNDS} rounds · {Math.round(puzzle.answerMs / 1000)} seconds each · each answer once
          </p>
          <button
            className={button}
            data-hotkey="Enter Space"
            onClick={() => save({ moves: [], start: Date.now(), over: false })}
          >
            Start the climb
          </button>
        </div>
      )}

      {clock && prompt && !run.over && (
        <form
          className={`${card} space-y-3`}
          onSubmit={(e) => {
            e.preventDefault()
            send(draft, hint?.text === draft.trim())
          }}
        >
          <h2 className="text-2xl font-bold">{prompt.prompt}</h2>
          <div
            role="timer"
            aria-label={clock.reading ? 'Reading time left' : 'Seconds left to answer'}
            className="flex items-center gap-3"
          >
            <span className="w-16 shrink-0 text-sm text-[var(--ink-muted)]">{clock.reading ? 'Read' : 'Answer'}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--ink-border)]">
              <span
                className="block h-full rounded-full"
                style={{
                  width:
                    (100 * (clock.reading ? clock.reading / puzzle.readingMs : clock.left / puzzle.answerMs) || 0) +
                    '%',
                  background: !clock.reading && clock.left <= 5000 ? 'var(--game-color)' : 'var(--ink-muted)',
                }}
              />
            </span>
            <span className="w-8 text-right font-semibold tabular-nums">
              {Math.ceil((clock.reading || clock.left) / 1000)}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              ref={input}
              aria-label="Your answer"
              placeholder={clock.reading ? 'Get ready…' : 'Your answer'}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              maxLength={80}
              readOnly={!answering}
              className="min-w-0 flex-1 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return
                setDraft('')
                setHint(null)
              }}
            />
            <button className={button} disabled={!answering}>
              Send
            </button>
          </div>
          {hint && (
            <button
              type="button"
              className="min-h-10 rounded-full border border-[var(--ink-border)] bg-[var(--ink-bg)] px-4 text-sm"
              onClick={() => send(hint.label, true)}
            >
              {hint.label}?
            </button>
          )}
          {cleared > 0 && (
            <p className="text-sm text-[var(--ink-muted)]">Used: {run.moves.map((m) => label(m.id)).join(', ')}</p>
          )}
        </form>
      )}

      {run.over && (
        <div className={`${card} space-y-3 text-center`}>
          <h2 className="kabloom-erupt text-2xl font-bold">{cleared === KABLOOM_ROUNDS ? 'Summit!' : 'Kabloom!'}</h2>
          <p className="text-lg tabular-nums">
            {cleared} of {KABLOOM_ROUNDS} rounds
          </p>
          <p className="text-sm text-[var(--ink-muted)]">Saved to your daily scores</p>
          <button
            className={button}
            data-hotkey="s"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(share)
                setNote('Result copied.')
              } catch {
                setNote(share)
              }
            }}
          >
            Copy result
          </button>
        </div>
      )}

      {(run.over || cleared > 0) && (
        <ol className={`${card} space-y-2 text-sm`}>
          {puzzle.rounds.slice(0, run.over ? KABLOOM_ROUNDS : cleared).map((r, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span>
                <span className="text-[var(--ink-muted)]">
                  {i + 1}. {r.prompt}
                </span>{' '}
                <strong>{run.moves[i] ? label(run.moves[i].id) : '—'}</strong>
              </span>
              {run.over && <span className="text-[var(--ink-muted)]">{r.accepted.map(label).join(' · ')}</span>}
            </li>
          ))}
        </ol>
      )}
      <p role="status" className="min-h-5 text-sm whitespace-pre-line text-[var(--ink-muted)]">
        {note}
      </p>
    </section>
  )
}
