'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { shuffle } from '@/lib/random'
import type { ConnectionsDifficulty, ConnectionsGroup, ConnectionsProgress, ConnectionsPuzzle } from '@/lib/connections'
import {
  CONNECTIONS_DIFFICULTIES,
  findMatchingGroup,
  guessKey,
  isOneAway,
  normalizeWord,
  sortGroupsByDifficulty,
  wordKey,
} from '@/lib/connections'

const TIER_BG: Record<ConnectionsDifficulty, string> = {
  yellow: '#f9df6d',
  green: '#a0c35a',
  blue: '#b0c4ef',
  purple: '#ba81c5',
}

const TIER_LABEL: Record<ConnectionsDifficulty, string> = {
  yellow: 'Y',
  green: 'G',
  blue: 'B',
  purple: 'P',
}

const MAX_MISTAKES = 4

type Tile = { word: string; difficulty: ConnectionsDifficulty; category: string }

export type ConnectionsCompletePayload = {
  won: boolean
  wrongGuesses: number
  solvedDifficulties: ConnectionsDifficulty[]
}

export type ConnectionsBoardProps = {
  puzzle: ConnectionsPuzzle
  onComplete: (p: ConnectionsCompletePayload) => void
  /** Restores a saved game. */
  initialProgress?: ConnectionsProgress | undefined
  /** Called after every guess or give-up so the caller can save the game. */
  onProgress?: (p: ConnectionsProgress) => void
}

export default function ConnectionsBoard({ puzzle, onComplete, initialProgress, onProgress }: ConnectionsBoardProps) {
  const allTiles = useMemo(() => {
    const tiles: Tile[] = []
    for (const g of puzzle.groups) {
      for (const w of g.words) {
        tiles.push({ word: w, difficulty: g.difficulty, category: g.category })
      }
    }
    return tiles
  }, [puzzle.groups])

  const [order, setOrder] = useState<Tile[]>(() => shuffle(allTiles))
  const [progress, setProgress] = useState<ConnectionsProgress>(
    () => initialProgress ?? { guesses: [], gaveUp: false },
  )
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [shake, setShake] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const finishedRef = useRef(false)

  const solved = useMemo(
    () =>
      progress.guesses
        .map((g) => findMatchingGroup(puzzle.groups, g))
        .filter((g): g is ConnectionsGroup => g !== null),
    [progress.guesses, puzzle.groups],
  )
  const wrongGuesses = progress.guesses.length - solved.length
  const won = solved.length === puzzle.groups.length
  const done = won || wrongGuesses >= MAX_MISTAKES || progress.gaveUp
  const mistakesRemaining = Math.max(0, MAX_MISTAKES - wrongGuesses)

  const revealed = useMemo(() => {
    if (!done || won) return solved
    const rest = puzzle.groups.filter((g) => !solved.includes(g))
    return [...solved, ...sortGroupsByDifficulty(rest)]
  }, [done, won, solved, puzzle.groups])

  const pool = useMemo(() => {
    if (done) return []
    const solvedKeys = new Set(solved.flatMap((g) => g.words.map(wordKey)))
    return order.filter((t) => !solvedKeys.has(wordKey(t.word)))
  }, [done, solved, order])

  useEffect(() => {
    if (!done || finishedRef.current) return
    finishedRef.current = true
    onComplete({ won, wrongGuesses, solvedDifficulties: solved.map((g) => g.difficulty) })
  }, [done, won, wrongGuesses, solved, onComplete])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const flash = useCallback((msg: string) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const commit = useCallback(
    (next: ConnectionsProgress) => {
      setProgress(next)
      onProgress?.(next)
    },
    [onProgress],
  )

  const toggleSel = useCallback(
    (word: string) => {
      if (done) return
      const k = wordKey(word)
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(k)) next.delete(k)
        else if (next.size < 4) next.add(k)
        return next
      })
    },
    [done],
  )

  const submit = useCallback(() => {
    if (done) return
    const selectedWords = [...selectedKeys]
      .map((k) => pool.find((t) => wordKey(t.word) === k)?.word)
      .filter((w): w is string => Boolean(w))
    if (selectedWords.length !== 4) return

    const key = guessKey(selectedWords)
    if (progress.guesses.some((g) => guessKey(g) === key)) {
      flash('Already guessed!')
      return
    }

    commit({ ...progress, guesses: [...progress.guesses, selectedWords] })
    setSelectedKeys(new Set())
    if (findMatchingGroup(puzzle.groups, selectedWords)) return

    setShake(true)
    setTimeout(() => setShake(false), 420)
    if (isOneAway(puzzle.groups, selectedWords)) flash('One away!')
  }, [done, selectedKeys, pool, progress, puzzle.groups, commit, flash])

  const deselectAll = useCallback(() => setSelectedKeys(new Set()), [])

  const shufflePool = useCallback(() => {
    if (done) return
    setOrder((p) => shuffle(p))
  }, [done])

  const giveUp = useCallback(() => {
    if (done) return
    if (!window.confirm('Reveal all groups and end this run?')) return
    setSelectedKeys(new Set())
    commit({ ...progress, gaveUp: true })
  }, [done, progress, commit])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return
      const t = e.target as HTMLElement
      if (t?.closest('input') || t?.closest('textarea')) return
      if (e.key === 'Enter' && selectedKeys.size === 4) {
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, selectedKeys.size, submit])

  return (
    <div className="w-full max-w-xl mx-auto space-y-4" data-testid="connections-board">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1" aria-label="Mistakes remaining">
          {CONNECTIONS_DIFFICULTIES.map((_, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-full border-2"
              style={{
                borderColor: 'var(--ink-border)',
                backgroundColor: i < mistakesRemaining ? 'var(--ink-accent)' : 'transparent',
              }}
            />
          ))}
        </div>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {mistakesRemaining} {mistakesRemaining === 1 ? 'life' : 'lives'} left
        </p>
      </div>

      {revealed.length > 0 && (
        <div className="space-y-2">
          {revealed.map((g) => (
            <div
              key={`${g.difficulty}-${g.category}`}
              data-testid="connections-revealed-group"
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--ink-border)' }}
            >
              <div
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-semibold"
                style={{ backgroundColor: TIER_BG[g.difficulty], color: '#111' }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="rounded px-1 text-xs font-bold"
                    style={{ backgroundColor: 'rgba(0,0,0,0.12)' }}
                    aria-hidden
                  >
                    {TIER_LABEL[g.difficulty]}
                  </span>
                  {g.category}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 p-2" style={{ backgroundColor: 'var(--ink-bg)' }}>
                {g.words.map((w) => (
                  <div
                    key={wordKey(w)}
                    className="rounded-md px-2 py-2 text-center text-sm font-medium"
                    style={{ backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
                  >
                    {normalizeWord(w)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!done && (
        <>
          <div
            className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${shake ? 'animate-pulse' : ''}`}
            style={{ animationDuration: shake ? '0.15s' : undefined }}
          >
            {pool.map((t) => {
              const sel = selectedKeys.has(wordKey(t.word))
              return (
                <button
                  key={`${wordKey(t.word)}-${t.word}`}
                  type="button"
                  onClick={() => toggleSel(t.word)}
                  className="rounded-lg border-2 px-2 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2"
                  style={{
                    borderColor: sel ? 'var(--ink-accent)' : 'var(--ink-border)',
                    backgroundColor: sel ? 'var(--ink-bg)' : 'var(--ink-paper)',
                    color: 'var(--ink-text)',
                    boxShadow: sel ? '0 0 0 2px var(--ink-accent)' : undefined,
                  }}
                >
                  {normalizeWord(t.word)}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selectedKeys.size !== 4}
              onClick={submit}
              className="rounded-lg px-4 py-2 text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--ink-accent)' }}
            >
              Submit
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
              style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            >
              Deselect all
            </button>
            <button
              type="button"
              onClick={shufflePool}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
              style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            >
              Shuffle
            </button>
            <button
              type="button"
              onClick={giveUp}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
              style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            >
              Give up
            </button>
          </div>
        </>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2 shadow-lg"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
