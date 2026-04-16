'use client'

import { memo, useCallback, useState } from 'react'
import {
  CAN_LABELS,
  applySwap,
  countCorrect,
  randomDerangedStart,
  randomPermutation,
  type Perm5,
} from '@/lib/five-can-game'

type GameState = {
  target: Perm5
  current: Perm5
  moves: number
  lastFeedback: number | null
  won: boolean
}

function initialState(): GameState {
  const target = randomPermutation()
  const current = randomDerangedStart(target)
  return {
    target,
    current,
    moves: 0,
    lastFeedback: null,
    won: false,
  }
}

const Slot = memo(function Slot({
  idx,
  label,
  selected,
  disabled,
  onPick,
}: {
  idx: number
  label: string
  selected: 'first' | 'second' | null
  disabled: boolean
  onPick: (i: number) => void
}) {
  const ring =
    selected === 'first'
      ? 'ring-2 ring-[var(--ink-accent)] ring-offset-2'
      : selected === 'second'
        ? 'ring-2 ring-[var(--ink-muted)] ring-offset-2'
        : ''
  return (
    <button
      type="button"
      data-testid={`five-can-slot-${idx}`}
      disabled={disabled}
      onClick={() => onPick(idx)}
      className={`flex min-h-[52px] min-w-[52px] flex-col items-center justify-center rounded-lg border px-3 py-3 text-lg font-semibold transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 disabled:opacity-50 ${ring}`}
      style={{
        backgroundColor: 'var(--ink-paper)',
        borderColor: 'var(--ink-border)',
        color: 'var(--ink-text)',
      }}
    >
      <span className="text-xs font-normal" style={{ color: 'var(--ink-muted)' }}>
        {idx + 1}
      </span>
      <span className="font-lora text-2xl">{label}</span>
    </button>
  )
})

export default function FiveCanGame() {
  const [g, setG] = useState<GameState>(() => initialState())
  const [first, setFirst] = useState<number | null>(null)
  const [second, setSecond] = useState<number | null>(null)

  const pick = useCallback(
    (i: number) => {
      if (g.won) return
      if (first === null) {
        setFirst(i)
        return
      }
      if (first === i) {
        setFirst(null)
        return
      }
      if (second === null) {
        setSecond(i)
        return
      }
      if (second === i) {
        setSecond(null)
        return
      }
      setFirst(i)
      setSecond(null)
    },
    [first, second, g.won],
  )

  const doSwap = useCallback(() => {
    if (g.won || first === null || second === null) return
    const next = applySwap(g.current, first, second)
    const fb = countCorrect(next, g.target)
    setG((prev) => ({
      ...prev,
      current: next,
      moves: prev.moves + 1,
      lastFeedback: fb,
      won: fb === 5,
    }))
    setFirst(null)
    setSecond(null)
  }, [first, second, g])

  const newGame = useCallback(() => {
    setG(initialState())
    setFirst(null)
    setSecond(null)
  }, [])

  const labels = g.current.map((id) => CAN_LABELS[id])

  const canSwap = first !== null && second !== null && !g.won

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>
          5 Can Sorting
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Five cans (A–E) have a hidden correct left-to-right order. You start with{' '}
          <strong style={{ color: 'var(--ink-text)' }}>no</strong> cans in the right place. Swap two positions;
          after each swap you only see how many cans are now correct (positional feedback). Reach{' '}
          <strong style={{ color: 'var(--ink-text)' }}>5</strong> correct to win.
        </p>
      </header>

      <div
        className="rounded-lg border p-4 md:p-6"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'transparent' }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span style={{ color: 'var(--ink-muted)' }}>
            Moves: <strong style={{ color: 'var(--ink-text)' }}>{g.moves}</strong>
          </span>
          {g.lastFeedback !== null && (
            <span data-testid="five-can-feedback" style={{ color: 'var(--ink-text)' }}>
              Last feedback:{' '}
              <strong>
                {g.lastFeedback} / 5
              </strong>{' '}
              correct
            </span>
          )}
        </div>

        <p className="mb-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
          Tap two positions, then Swap. Numbers 1–5 are slots (left to right).
        </p>

        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {[0, 1, 2, 3, 4].map((idx) => (
            <Slot
              key={idx}
              idx={idx}
              label={labels[idx] ?? '?'}
              selected={first === idx ? 'first' : second === idx ? 'second' : null}
              disabled={g.won}
              onPick={pick}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            data-testid="five-can-swap"
            disabled={!canSwap}
            onClick={doSwap}
            className="min-h-[44px] min-w-[120px] rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 disabled:opacity-45"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Swap
          </button>
          <button
            type="button"
            data-testid="five-can-new"
            onClick={newGame}
            className="min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2"
            style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-accent)' }}
          >
            New game
          </button>
        </div>

        {g.won && (
          <div
            className="mt-6 rounded-lg border p-4 text-center"
            style={{ borderColor: 'var(--ink-accent)', backgroundColor: 'var(--ink-paper)' }}
            data-testid="five-can-won"
          >
            <p className="font-lora text-lg font-semibold" style={{ color: 'var(--ink-text)' }}>
              Solved — all five cans match the hidden order.
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              Target order (left → right):{' '}
              <span className="font-semibold" style={{ color: 'var(--ink-text)' }}>
                {g.target.map((id) => CAN_LABELS[id]).join(' ')}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
