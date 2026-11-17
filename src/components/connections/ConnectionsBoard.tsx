'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { shuffle } from '@/lib/random'
import type { ConnectionsDifficulty, ConnectionsGroup, ConnectionsProgress, ConnectionsPuzzle } from '@/lib/connections'
import {
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
  yellow: '1 · Easy',
  green: '2',
  blue: '3',
  purple: '4 · Hard',
}

const MAX_MISTAKES = 4

type Tile = { word: string; difficulty: ConnectionsDifficulty; category: string }

export type ConnectionsCompletePayload = {
  won: boolean
  wrongGuesses: number
  solvedDifficulties: ConnectionsDifficulty[]
  /** Each guess as the difficulty of its 4 words, in the order guessed, for the share grid. */
  guessColors: ConnectionsDifficulty[][]
}

/**
 * Picks a tile font size that keeps the longest word of a tile on one line in a 4-column phone grid.
 */
function tileText(word: string): string {
  const longest = Math.max(...word.split(/\s+/).map((w) => w.length))
  if (longest <= 6) return 'text-[15px] sm:text-lg'
  if (longest <= 8) return 'text-[13px] sm:text-base'
  if (longest <= 10) return 'text-[11.5px] sm:text-[15px]'
  return 'text-[10px] sm:text-sm'
}

const pill = 'rounded-full border px-4 py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-40'

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
    const tier = new Map(allTiles.map((t) => [wordKey(t.word), t.difficulty]))
    onComplete({
      won,
      wrongGuesses,
      solvedDifficulties: solved.map((g) => g.difficulty),
      guessColors: progress.guesses.map((g) => g.map((w) => tier.get(wordKey(w)) ?? 'yellow')),
    })
  }, [done, won, wrongGuesses, solved, onComplete, allTiles, progress.guesses])

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
    if (findMatchingGroup(puzzle.groups, selectedWords)) {
      setSelectedKeys(new Set())
      return
    }

    setShake(true)
    setTimeout(() => setShake(false), 420)
    if (isOneAway(puzzle.groups, selectedWords)) flash('One away...')
  }, [done, selectedKeys, pool, progress, puzzle.groups, commit, flash])

  const deselectAll = useCallback(() => setSelectedKeys(new Set()), [])

  const shufflePool = useCallback(() => {
    if (done) return
    setOrder((p) => shuffle(p))
  }, [done])

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

  const neutral = puzzle.difficultyKnown === false
  return (
    <div className="relative mx-auto w-full max-w-[600px] select-none space-y-3" data-testid="connections-board">
      <style>{`@keyframes cx-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}
        75%{transform:translateX(6px)}}`}</style>
      {toast && (
        <div
          role="status"
          className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full rounded-md px-3 py-1.5 text-sm font-semibold"
          style={{ background: '#121212', color: '#fff' }}
        >
          {toast}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {revealed.map((g) => (
          <div
            key={`${g.difficulty}-${g.category}`}
            data-testid="connections-revealed-group"
            title={neutral ? undefined : `Difficulty ${TIER_LABEL[g.difficulty]}`}
            className="col-span-4 flex min-h-[72px] flex-col items-center justify-center rounded-md px-2 py-1 text-center sm:min-h-20"
            style={{ backgroundColor: neutral ? '#d5dce4' : TIER_BG[g.difficulty], color: '#000' }}
          >
            <p className="text-sm font-bold uppercase sm:text-base">{g.category}</p>
            <p className="text-xs uppercase sm:text-sm">{g.words.map(normalizeWord).join(', ')}</p>
          </div>
        ))}
        {pool.map((t) => {
          const sel = selectedKeys.has(wordKey(t.word))
          return (
            <button
              key={`${wordKey(t.word)}-${t.word}`}
              type="button"
              aria-pressed={sel}
              onClick={() => toggleSel(t.word)}
              className={`flex h-[72px] items-center justify-center rounded-md px-0.5 text-center font-bold uppercase
                leading-tight transition-colors focus:outline-none focus-visible:ring-2 sm:h-20 ${tileText(t.word)}`}
              style={{
                backgroundColor: sel ? '#5a594e' : '#efefe6',
                color: sel ? '#fff' : '#000',
                animation: sel && shake ? 'cx-shake .2s 2' : undefined,
              }}
            >
              {normalizeWord(t.word)}
            </button>
          )
        })}
      </div>

      {!done && (
        <>
          <div className="flex items-center justify-center gap-2 text-sm" aria-label={`${mistakesRemaining} mistakes remaining`}>
            Mistakes remaining:
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-full transition-opacity"
                style={{ backgroundColor: '#5a594e', opacity: i < mistakesRemaining ? 1 : 0 }}
              />
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <button type="button" title="Shuffle the tiles" className={pill} style={{ borderColor: 'currentColor' }} onClick={shufflePool}>
              Shuffle
            </button>
            <button
              type="button"
              className={pill}
              style={{ borderColor: 'currentColor' }}
              disabled={!selectedKeys.size}
              onClick={deselectAll}
            >
              Deselect all
            </button>
            <button
              type="button"
              title="Submit (Enter)"
              className={pill}
              disabled={selectedKeys.size !== 4}
              onClick={submit}
              style={
                selectedKeys.size === 4
                  ? { backgroundColor: 'var(--ink-text)', borderColor: 'var(--ink-text)', color: 'var(--ink-bg)' }
                  : { borderColor: 'currentColor' }
              }
            >
              Submit
            </button>
          </div>
        </>
      )}
    </div>
  )
}
