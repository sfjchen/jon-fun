'use client'

/**
 * Plays the Fivefold daily: 6 tries to find a 5-letter word, with per-letter marks, a typed or on-screen keyboard,
 * a saved run per day and a shareable result. Like the original, it counts guesses only, with no clock.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { isPracticeResult, logResult, markPracticeIfFuture } from '@/lib/results'
import { loadFivefoldStats, type FivefoldStats } from '@/lib/daily/fivefold-stats'
import { FIVEFOLD_TRIES as TRIES, hardError, marks, type Mark } from '@/lib/daily/fivefold'

export type FivefoldPuzzle = { answer: string }
type Run = { guesses: string[]; hard: boolean }

const ROWS = ['qwertyuiop', 'asdfghjkl', '↵zxcvbnm⌫']
const HARD_KEY = 'fivefold:hard'
const RANK: Record<Mark, number> = { miss: 1, near: 2, hit: 3 }
let words: Promise<Set<string>> | null = null

/**
 * Renders the board, keyboard and result for one day.
 */
export default function FivefoldPlay({ puzzle, dailyDay }: { puzzle: FivefoldPuzzle; dailyDay: string }) {
  const answer = puzzle.answer
  const storageKey = `fivefold:nyt-v2:${dailyDay}:${answer}`
  const [run, setRun] = useState<Run>(() => {
    try {
      const r = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Run | null
      if (r && Array.isArray(r.guesses) && r.guesses.every((g) => /^[a-z]{5}$/.test(g)))
        return { guesses: r.guesses.slice(0, TRIES), hard: !!r.hard }
    } catch {}
    return { guesses: [], hard: false }
  })
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hardPref, setHardPref] = useState(() => {
    try {
      return localStorage.getItem(HARD_KEY) === '1'
    } catch {
      return false
    }
  })
  const [statsOpen, setStatsOpen] = useState(false)
  const [stats, setStats] = useState<FivefoldStats | null>(null)
  const current = useRef(run)
  const won = run.guesses.at(-1) === answer
  const done = won || run.guesses.length >= TRIES
  const hard = run.guesses.length ? !!run.hard : hardPref

  const commit = useCallback(
    (r: Run) => {
      current.current = r
      setRun(r)
      try {
        localStorage.setItem(storageKey, JSON.stringify(r))
      } catch {}
    },
    [storageKey],
  )

  useEffect(() => {
    words ??= fetch('/fivefold/words.json')
      .then((r) => r.json())
      .then((list: string[]) => new Set(list))
  }, [])

  useEffect(() => {
    if (!statsOpen) return
    void loadFivefoldStats().then(setStats)
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStatsOpen(false)
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [statsOpen])

  const flash = (text: string) => {
    setMessage(text)
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const press = useCallback(
    async (key: string) => {
      if (done) return
      if (!current.current.guesses.length) markPracticeIfFuture('fivefold', dailyDay)
      setMessage('')
      if (key === '⌫' || key === 'backspace') return setDraft((d) => d.slice(0, -1))
      if (/^[a-z]$/.test(key)) return setDraft((d) => (d.length < 5 ? d + key : d))
      if (key !== '↵' && key !== 'enter') return
      if (draft.length < 5) return flash('Not enough letters')
      if (draft !== answer && !(await words)?.has(draft)) return flash('Not in the word list')
      const latest = current.current
      // A repeated Enter from before the last re-render sees the board already moved on and drops its stale draft.
      if (latest.guesses.length !== run.guesses.length) return
      const fail = latest.hard || (!latest.guesses.length && hardPref) ? hardError(draft, latest.guesses, answer) : ''
      if (fail) return flash(fail)
      const guesses = [...latest.guesses, draft]
      const over = draft === answer || guesses.length >= TRIES
      setDraft('')
      if (!over) return commit({ ...latest, guesses, hard: latest.guesses.length ? latest.hard : hardPref })
      const final = { guesses, hard: latest.guesses.length ? latest.hard : hardPref }
      commit(final)
      setStatsOpen(true)
      // Logged once, when the last guess lands, so reloading a finished board never re-sends it.
      const hit = draft === answer
      logResult('fivefold', hit ? TRIES + 1 - guesses.length : 0, guesses.length, dailyDay, {
        solved: hit,
        moves: guesses,
        sourceDate: dailyDay,
        puzzleId: `nyt-wordle:${dailyDay}`,
        ...(final.hard ? { hard: true } : {}),
      })
    },
    [done, draft, answer, commit, dailyDay, hardPref, run.guesses.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest?.('input,textarea,[role=dialog]'))
        return
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
  const rows = Array.from(
    { length: TRIES },
    (_, i) => run.guesses[i] ?? (i === run.guesses.length && !done ? draft : ''),
  )
  const toggleHard = () => {
    // Like Wordle, hard mode can be dropped mid-game but only picked up before the first guess.
    if (done) return
    if (run.guesses.length && !hard) return flash('Hard mode can only be turned on at the start of the day')
    if (run.guesses.length) commit({ ...current.current, hard: false })
    setHardPref(!hard)
    try {
      localStorage.setItem(HARD_KEY, hard ? '0' : '1')
    } catch {}
  }
  const share = () => {
    const icon: Record<Mark, string> = { hit: '🟩', near: '🟨', miss: '⬛' }
    const text = [
      `Wordle ${dailyDay} ${won ? run.guesses.length : 'X'}/6${run.hard ? '*' : ''}`,
      ...run.guesses.map((g) =>
        marks(g, answer)
          .map((m) => icon[m])
          .join(''),
      ),
      'sfjc.dev/games/wordle',
    ].join('\n')
    void navigator.clipboard.writeText(text).then(() => setCopied(true))
  }

  return (
    <section className="fivefold mx-auto max-w-md space-y-4" data-testid="fivefold-play">
      <div
        className="flex items-center justify-between border-b pb-2 text-sm"
        style={{ borderColor: 'var(--ink-border)' }}
      >
        <span className="flex items-center gap-3">
          <button type="button" role="switch" aria-checked={hard} className="fivefold-hard" onClick={toggleHard}>
            Hard mode <i data-on={hard} />
          </button>
          <button type="button" className="fivefold-link" onClick={() => setStatsOpen(true)}>
            Stats
          </button>
        </span>
        <span className="text-[var(--ink-muted)]">
          {isPracticeResult('fivefold', dailyDay) ? 'Practice' : `${run.guesses.length}/${TRIES}`}
        </span>
      </div>
      <p role="status" aria-live="polite" className="min-h-6 text-center text-sm font-medium">
        {message}
      </p>
      <div className="mx-auto grid w-full max-w-[300px] gap-1.5 sm:max-w-[340px]" aria-label="Guesses">
        {rows.map((word, r) => {
          const scored = r < run.guesses.length ? marks(word, answer) : null
          return (
            <div
              key={r}
              className={`grid grid-cols-5 gap-1.5 ${shake && r === run.guesses.length ? 'fivefold-shake' : ''}`}
            >
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
          <h2 className="text-xl font-bold">
            {won ? `Found in ${run.guesses.length}/6${run.hard ? '*' : ''}` : `The word was ${answer.toUpperCase()}`}
          </h2>
          <p className="text-sm text-[var(--ink-muted)]">
            {isPracticeResult('fivefold', dailyDay) ? 'Future preview · practice only' : 'Saved to your daily scores'}
          </p>
          <button
            className="rounded-full bg-[var(--game-color)] px-5 py-2 text-sm font-semibold text-white"
            onClick={share}
          >
            {copied ? 'Copied' : 'Copy result'}
          </button>
          <button className="fivefold-link block w-full" onClick={() => setStatsOpen(true)}>
            Stats
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
      {statsOpen && (
        <div className="fivefold-overlay" onClick={() => setStatsOpen(false)}>
          <div role="dialog" aria-label="Statistics" className="fivefold-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-center text-lg font-bold">Statistics</h2>
            {stats ? (
              <>
                <div className="grid grid-cols-4 text-center">
                  {(
                    [
                      ['Played', stats.played],
                      ['Win %', stats.played ? Math.round((stats.wins / stats.played) * 100) : 0],
                      ['Current Streak', stats.cur],
                      ['Max Streak', stats.max],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k}>
                      <div className="text-2xl font-bold tabular-nums">{v}</div>
                      <div className="text-xs">{k}</div>
                    </div>
                  ))}
                </div>
                <h3 className="text-center text-sm font-bold uppercase">Guess Distribution</h3>
                {stats.dist.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-3">{i + 1}</span>
                    <span
                      className="fivefold-bar"
                      data-today={done && won && run.guesses.length === i + 1}
                      style={{ width: `${Math.max(8, (n / Math.max(1, ...stats.dist)) * 100)}%` }}
                    >
                      {n}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-center text-sm">Loading...</p>
            )}
            <button className="fivefold-link block w-full" onClick={() => setStatsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
