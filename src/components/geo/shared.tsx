'use client'

/**
 * The pieces the 4 geography dailies share: the saved run of a day, the box that takes a typed place name, and the
 * finished card with its copy button.
 */

import { useId, useState, type ReactNode } from 'react'
import { runKey } from '@/lib/daily/saved-run'
import { findByName, type GeoGame, type Run } from '@/lib/geo-games'
import { logResult } from '@/lib/results'

export const card = 'rounded-xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-4 sm:p-5'
export const primary = 'rounded-lg bg-[var(--game-color)] px-5 py-2 font-semibold text-white disabled:opacity-40'

/**
 * Keeps a day's moves in this browser, where the saved-run check and the state mirror read and write them. A move
 * that ends the run sends the result.
 */
export function useMoves<T>(game: GeoGame, day: string, replay: (moves: T[]) => Run | null) {
  const key = runKey(game, day, day)
  const [moves, setMoves] = useState<T[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(saved) && replay(saved as T[]) ? (saved as T[]) : []
    } catch {
      return []
    }
  })
  const play = (move: T) => {
    const next = [...moves, move],
      run = replay(next)
    if (!run) return
    setMoves(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {}
    if (run.done) logResult(game, run.score, next.length, day, { moves: next, sourceDate: day, solved: run.solved })
  }
  return [moves, replay(moves)!, play] as const
}

/**
 * Takes a typed place name and hands back the listed place it names. Names already used are left off the list.
 */
export function PlaceInput<T extends { id: string; name: string }>({
  list,
  used,
  label,
  onPick,
}: {
  list: T[]
  used: string[]
  label: string
  onPick: (place: T) => void
}) {
  const id = useId()
  const [typed, setTyped] = useState('')
  const [notice, setNotice] = useState('')
  const open = list.filter((c) => !used.includes(c.id))
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault()
        const place = findByName(open, typed)
        if (!place) return setNotice(findByName(list, typed) ? 'Already used.' : 'Pick a country from the list.')
        setTyped('')
        setNotice('')
        onPick(place)
      }}
    >
      <div className="flex gap-2">
        <input
          aria-label={label}
          placeholder={label}
          list={id}
          autoComplete="off"
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <datalist id={id}>
          {open.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <button className={primary}>Guess</button>
      </div>
      <p role="status" className="min-h-5 text-sm text-[var(--ink-muted)]">
        {notice}
      </p>
    </form>
  )
}

/**
 * Shows a finished game: its headline, any detail, and a button that copies the share text.
 */
export function Finished({ title, share, children }: { title: string; share: string; children?: ReactNode }) {
  const [notice, setNotice] = useState('')
  return (
    <div className={`${card} space-y-2 text-center`} data-testid="geo-result">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
      <p className="text-sm text-[var(--ink-muted)]">Saved to your daily scores</p>
      <button
        className="rounded-full bg-[var(--game-color)] px-5 py-2 text-sm font-semibold text-white"
        data-hotkey="s"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(share)
            setNotice('Result copied.')
          } catch {
            setNotice(share)
          }
        }}
      >
        Copy result
      </button>
      <p role="status" className="min-h-5 text-sm whitespace-pre-line text-[var(--ink-muted)]">
        {notice}
      </p>
    </div>
  )
}
