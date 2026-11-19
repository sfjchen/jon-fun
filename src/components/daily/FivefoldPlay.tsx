'use client'

/**
 * Plays the Fivefold daily: 6 tries to find a 5-letter word, with per-letter marks, a typed or on-screen keyboard,
 * an active-time clock that pauses while the page is hidden, a saved run per day and a shareable result.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime, isPracticeResult, logResult, markPracticeIfFuture } from '@/lib/results'

export type FivefoldPuzzle = { answer: string }
type Mark = 'hit' | 'near' | 'miss'
type Run = { guesses: string[]; elapsedMs: number; activeSince: number | null }

const TRIES = 6
const ROWS = ['qwertyuiop', 'asdfghjkl', '↵zxcvbnm⌫']
const RANK: Record<Mark, number> = { miss: 1, near: 2, hit: 3 }
let words: Promise<Set<string>> | null = null

/**
 * Marks each letter of a guess: right spot, elsewhere in the word (counting repeats), or absent.
 */
function marks(guess: string, answer: string): Mark[] {
  const out: Mark[] = Array(5).fill('miss')
  const left = new Map<string, number>()
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) out[i] = 'hit'
    else left.set(answer[i]!, (left.get(answer[i]!) ?? 0) + 1)
  }
  for (let i = 0; i < 5; i++) {
    const n = left.get(guess[i]!) ?? 0
    if (out[i] === 'hit' || !n) continue
    out[i] = 'near'
    left.set(guess[i]!, n - 1)
  }
  return out
}

/**
 * Returns the active play time, including the running stretch.
 */
const elapsed = (r: Run, now: number) => r.elapsedMs + (r.activeSince === null ? 0 : Math.max(0, now - r.activeSince))

/**
 * Renders the board, keyboard and result for one day.
 */
export default function FivefoldPlay({ puzzle, dailyDay }: { puzzle: FivefoldPuzzle; dailyDay: string }) {
  const answer = puzzle.answer
  const storageKey = `fivefold:v1:${dailyDay}`
  const [run, setRun] = useState<Run>(() => {
    try {
      const r = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Run | null
      if (r && Array.isArray(r.guesses) && r.guesses.every((g) => /^[a-z]{5}$/.test(g)) && Number.isFinite(r.elapsedMs)) {
        return { guesses: r.guesses.slice(0, TRIES), elapsedMs: r.elapsedMs, activeSince: null }
      }
    } catch {}
    return { guesses: [], elapsedMs: 0, activeSince: null }
  })
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(false)
  const [copied, setCopied] = useState(false)
  const [clock, setClock] = useState(() => Date.now())
  const current = useRef(run)
  const won = run.guesses.at(-1) === answer
  const done = won || run.guesses.length >= TRIES
  const seconds = Math.floor(elapsed(run, clock) / 1000)

  const commit = useCallback(
    (r: Run) => {
      current.current = r
      setRun(r)
      try { localStorage.setItem(storageKey, JSON.stringify({ ...r, elapsedMs: elapsed(r, Date.now()), activeSince: null })) } catch {}
    },
    [storageKey],
  )

  useEffect(() => {
    words ??= fetch('/fivefold/words.json').then((r) => r.json()).then((list: string[]) => new Set(list))
    const timer = setInterval(() => setClock(Date.now()), 1000)
    const pause = () => {
      const r = current.current
      if (r.activeSince !== null) commit({ ...r, elapsedMs: elapsed(r, Date.now()), activeSince: null })
    }
    const visibility = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pause)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', pause)
      pause()
    }
  }, [commit])

  const flash = (text: string) => {
    setMessage(text)
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const press = useCallback(
    async (key: string) => {
      if (done) return
      const r = current.current
      // The clock starts with the first key and resumes after the page was hidden.
      if (r.activeSince === null) {
        markPracticeIfFuture('fivefold', dailyDay)
        commit({ ...r, activeSince: Date.now() })
      }
      setMessage('')
      if (key === '⌫' || key === 'backspace') return setDraft((d) => d.slice(0, -1))
      if (/^[a-z]$/.test(key)) return setDraft((d) => (d.length < 5 ? d + key : d))
      if (key !== '↵' && key !== 'enter') return
      if (draft.length < 5) return flash('Not enough letters')
      if (!(await words)?.has(draft)) return flash('Not in the word list')
      const latest = current.current
      const guesses = [...latest.guesses, draft]
      const over = draft === answer || guesses.length >= TRIES
      setDraft('')
      if (!over) return commit({ ...latest, guesses })
      const final = { guesses, elapsedMs: elapsed(latest, Date.now()), activeSince: null }
      commit(final)
      // Logged once, when the last guess lands, so reloading a finished board never re-sends it.
      const hit = draft === answer
      logResult('fivefold', hit ? TRIES + 1 - guesses.length : 0, guesses.length, dailyDay, { solved: hit, seconds: Math.floor(final.elapsedMs / 1000), puzzleId: `fivefold:${dailyDay}` })
    },
    [done, draft, answer, commit, dailyDay],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest?.('input,textarea,[role=dialog]')) return
      const k = e.key.toLowerCase()
      if (k === 'enter' || k === 'backspace' || /^[a-z]$/.test(k)) {
        e.preventDefault()
        void press(k)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  const keyMarks = new Map<string, Mark>()
  for (const g of run.guesses) {
    marks(g, answer).forEach((m, i) => {
      const prev = keyMarks.get(g[i]!)
      if (!prev || RANK[m] > RANK[prev]) keyMarks.set(g[i]!, m)
    })
  }
  const rows = Array.from({ length: TRIES }, (_, i) => run.guesses[i] ?? (i === run.guesses.length && !done ? draft : ''))
  const share = () => {
    const icon: Record<Mark, string> = { hit: '🟢', near: '🟡', miss: '⚪' }
    const text = [
      `Fivefold ${dailyDay} ${won ? run.guesses.length : 'X'}/6 · ${formatTime(Math.floor(run.elapsedMs / 1000))}`,
      ...run.guesses.map((g) => marks(g, answer).map((m) => icon[m]).join('')),
      'sfjc.dev/games/fivefold',
    ].join('\n')
    void navigator.clipboard.writeText(text).then(() => setCopied(true))
  }

  return (
    <section className="fivefold mx-auto max-w-md space-y-4" data-testid="fivefold-play">
      <div className="flex items-center justify-between border-b pb-2 text-sm" style={{ borderColor: 'var(--ink-border)' }}>
        <span className="tabular-nums" role="timer">{formatTime(seconds)}</span>
        <span className="text-[var(--ink-muted)]">{isPracticeResult('fivefold', dailyDay) ? 'Practice' : `${run.guesses.length}/${TRIES}`}</span>
      </div>
      <p role="status" aria-live="polite" className="min-h-6 text-center text-sm font-medium">{message}</p>
      <div className="mx-auto grid w-full max-w-[300px] gap-1.5 sm:max-w-[340px]" aria-label="Guesses">
        {rows.map((word, r) => {
          const scored = r < run.guesses.length ? marks(word, answer) : null
          return (
            <div key={r} className={`grid grid-cols-5 gap-1.5 ${shake && r === run.guesses.length ? 'fivefold-shake' : ''}`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="fivefold-tile" data-mark={scored?.[i] ?? (word[i] ? 'typed' : 'empty')}>
                  {word[i] ?? ''}
                </span>
              ))}
            </div>
          )
        })}
      </div>
      {done ? (
        <div className="space-y-2 rounded-xl bg-[var(--ink-paper)] p-4 text-center" data-testid="fivefold-result">
          <h2 className="text-xl font-bold">{won ? `Found in ${run.guesses.length}/6` : `The word was ${answer.toUpperCase()}`}</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            {formatTime(Math.floor(run.elapsedMs / 1000))} · {isPracticeResult('fivefold', dailyDay) ? 'Future preview · practice only' : 'Saved to your daily scores'}
          </p>
          <button className="rounded-full bg-[var(--game-color)] px-5 py-2 text-sm font-semibold text-white" onClick={share}>
            {copied ? 'Copied' : 'Copy result'}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 select-none" aria-label="Keyboard">
          {ROWS.map((row) => (
            <div key={row} className="flex justify-center gap-1">
              {[...row].map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`fivefold-key ${k === '↵' || k === '⌫' ? 'px-3' : ''}`}
                  data-mark={keyMarks.get(k) ?? 'none'}
                  aria-label={k === '↵' ? 'Enter' : k === '⌫' ? 'Delete' : k}
                  onClick={() => void press(k)}
                >
                  {k === '↵' ? 'Enter' : k}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
