'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConnectionsDifficulty, ConnectionsGroup, ConnectionsPuzzle } from '@/lib/connections'
import {
  CONNECTIONS_DIFFICULTIES,
  findMatchingGroup,
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

type Tile = { word: string; difficulty: ConnectionsDifficulty; category: string }

export type ConnectionsCompletePayload = {
  won: boolean
  wrongGuesses: number
  solvedDifficulties: ConnectionsDifficulty[]
}

export type ConnectionsBoardProps = {
  puzzle: ConnectionsPuzzle
  onComplete: (p: ConnectionsCompletePayload) => void
}

export default function ConnectionsBoard({ puzzle, onComplete }: ConnectionsBoardProps) {
  const allTiles = useMemo(() => {
    const tiles: Tile[] = []
    for (const g of puzzle.groups) {
      for (const w of g.words) {
        tiles.push({ word: w, difficulty: g.difficulty, category: g.category })
      }
    }
    return tiles
  }, [puzzle.groups])

  const [pool, setPool] = useState<Tile[]>(() => shuffleTiles(allTiles))
  const [revealed, setRevealed] = useState<ConnectionsGroup[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [wrongGuesses, setWrongGuesses] = useState(0)
  const [done, setDone] = useState(false)
  const [shake, setShake] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [solvedDifficulties, setSolvedDifficulties] = useState<ConnectionsDifficulty[]>([])
  const finishedRef = useRef(false)

  const mistakesRemaining = Math.max(0, 4 - wrongGuesses)

  const restart = useCallback(() => {
    finishedRef.current = false
    setPool(shuffleTiles(allTiles))
    setRevealed([])
    setSelectedKeys(new Set())
    setWrongGuesses(0)
    setDone(false)
    setShake(false)
    setToast(null)
    setSolvedDifficulties([])
  }, [allTiles])

  useEffect(() => {
    restart()
  }, [puzzle.id, restart])

  const toggleSel = useCallback((word: string) => {
    if (done) return
    const k = wordKey(word)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else if (next.size < 4) next.add(k)
      return next
    })
  }, [done])

  const submit = useCallback(() => {
    if (done) return
    const keys = [...selectedKeys]
    if (keys.length !== 4) return
    const selectedWords = keys.map((k) => pool.find((t) => wordKey(t.word) === k)?.word).filter(Boolean) as string[]
    if (selectedWords.length !== 4) return

    const match = findMatchingGroup(puzzle.groups, selectedWords)
    if (match) {
      const nextRevealed = [...revealed, match]
      const nextSolved = [...solvedDifficulties, match.difficulty]
      setRevealed(nextRevealed)
      setSolvedDifficulties(nextSolved)
      setPool((p) => p.filter((t) => !selectedWords.some((sw) => wordKey(sw) === wordKey(t.word))))
      setSelectedKeys(new Set())
      if (nextRevealed.length >= 4) {
        setDone(true)
        if (!finishedRef.current) {
          finishedRef.current = true
          onComplete({ won: true, wrongGuesses, solvedDifficulties: nextSolved })
        }
      }
      return
    }

    setShake(true)
    setTimeout(() => setShake(false), 420)
    const nextWrong = wrongGuesses + 1
    setWrongGuesses(nextWrong)
    if (isOneAway(puzzle.groups, selectedWords)) {
      setToast('One away!')
      setTimeout(() => setToast(null), 2000)
    }
    setSelectedKeys(new Set())

    if (nextWrong >= 4) {
      setDone(true)
      const rest = puzzle.groups.filter((g) => !revealed.some((r) => r.difficulty === g.difficulty))
      const ordered = sortGroupsByDifficulty(rest)
      setRevealed((r) => [...r, ...ordered])
      setPool([])
      if (!finishedRef.current) {
        finishedRef.current = true
        onComplete({
          won: false,
          wrongGuesses: nextWrong,
          solvedDifficulties: [...solvedDifficulties],
        })
      }
    }
  }, [
    done,
    selectedKeys,
    pool,
    puzzle.groups,
    revealed,
    wrongGuesses,
    solvedDifficulties,
    onComplete,
  ])

  const deselectAll = useCallback(() => setSelectedKeys(new Set()), [])

  const shufflePool = useCallback(() => {
    if (done) return
    setPool((p) => shuffleTiles(p))
  }, [done])

  const giveUp = useCallback(() => {
    if (done) return
    if (!window.confirm('Reveal all groups and end this run?')) return
    setDone(true)
    const rest = puzzle.groups.filter((g) => !revealed.some((r) => r.difficulty === g.difficulty))
    setRevealed((r) => [...r, ...sortGroupsByDifficulty(rest)])
    setPool([])
    setSelectedKeys(new Set())
    if (!finishedRef.current) {
      finishedRef.current = true
      onComplete({ won: false, wrongGuesses, solvedDifficulties: [...solvedDifficulties] })
    }
  }, [done, revealed, puzzle.groups, wrongGuesses, solvedDifficulties, onComplete])

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
              disabled={done}
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
          disabled={done || selectedKeys.size !== 4}
          onClick={submit}
          className="rounded-lg px-4 py-2 text-white disabled:opacity-40"
          style={{ backgroundColor: 'var(--ink-accent)' }}
        >
          Submit
        </button>
        <button
          type="button"
          disabled={done}
          onClick={deselectAll}
          className="rounded-lg border px-4 py-2 disabled:opacity-40"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          Deselect all
        </button>
        <button
          type="button"
          disabled={done}
          onClick={shufflePool}
          className="rounded-lg border px-4 py-2 disabled:opacity-40"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          Shuffle
        </button>
        <button
          type="button"
          disabled={done}
          onClick={giveUp}
          className="rounded-lg border px-4 py-2 disabled:opacity-40"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          Give up
        </button>
      </div>

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

function shuffleTiles<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmpI = a[i] as T
    const tmpJ = a[j] as T
    a[i] = tmpJ
    a[j] = tmpI
  }
  return a
}
