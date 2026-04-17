'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { FiveCanDoodle } from '@/components/FiveCanDoodle'
import {
  CAN_BRAND_NAMES,
  applySwap,
  countCorrect,
  randomDerangedStart,
  randomPermutation,
  type Perm5,
} from '@/lib/five-can-game'

type FeedbackEntry = { move: number; correct: number }

type GameState = {
  target: Perm5
  current: Perm5
  moves: number
  feedbackHistory: FeedbackEntry[]
  won: boolean
}

function initialState(): GameState {
  const target = randomPermutation()
  const current = randomDerangedStart(target)
  return {
    target,
    current,
    moves: 0,
    feedbackHistory: [],
    won: false,
  }
}

const Slot = memo(function Slot({
  idx,
  canId,
  selected,
  disabled,
  onPick,
}: {
  idx: number
  canId: number
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
  const brand = CAN_BRAND_NAMES[canId] ?? 'Can'
  return (
    <button
      type="button"
      data-testid={`five-can-slot-${idx}`}
      disabled={disabled}
      onClick={() => onPick(idx)}
      className={`flex w-[64px] shrink-0 flex-col items-center justify-start rounded-lg border px-1 pb-1.5 pt-1 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 disabled:opacity-50 sm:w-[72px] ${ring}`}
      style={{
        backgroundColor: 'var(--ink-paper)',
        borderColor: 'var(--ink-border)',
        color: 'var(--ink-text)',
      }}
    >
      <span className="mb-0.5 text-[10px] font-normal leading-none" style={{ color: 'var(--ink-muted)' }}>
        {idx + 1}
      </span>
      <div className="h-[88px] w-full [&>svg]:h-full [&>svg]:w-full">
        <FiveCanDoodle canId={canId} />
      </div>
      <span className="mt-0.5 line-clamp-2 min-h-[1.75rem] text-center text-[9px] leading-tight" style={{ color: 'var(--ink-muted)' }}>
        {brand}
      </span>
    </button>
  )
})

export default function FiveCanGame() {
  const [g, setG] = useState<GameState>(() => initialState())
  const [first, setFirst] = useState<number | null>(null)
  const [second, setSecond] = useState<number | null>(null)

  const currentCorrect = countCorrect(g.current, g.target)

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
    const moveNum = g.moves + 1
    setG((prev) => ({
      ...prev,
      current: next,
      moves: moveNum,
      feedbackHistory: [{ move: moveNum, correct: fb }, ...prev.feedbackHistory],
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

  const clearSelection = useCallback(() => {
    setFirst(null)
    setSecond(null)
  }, [])

  const keyCb = useRef({ pick, doSwap, newGame, clearSelection })
  keyCb.current = { pick, doSwap, newGame, clearSelection }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      const { pick: p, doSwap: swap, newGame: ng, clearSelection: clear } = keyCb.current

      if (e.key === 'Escape') {
        e.preventDefault()
        clear()
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        e.preventDefault()
        ng()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        swap()
        return
      }
      const n = e.key >= '1' && e.key <= '5' ? Number.parseInt(e.key, 10) - 1 : -1
      if (n >= 0 && n <= 4) {
        e.preventDefault()
        p(n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const canIds = g.current

  const canSwap = first !== null && second !== null && !g.won

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>
          5 Can Sorting
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Five doodle soda cans have a hidden left-to-right order. You start with{' '}
          <strong style={{ color: 'var(--ink-text)' }}>no</strong> cans correct. Swap two positions; after each
          swap you only see how many are in the right place. Reach <strong style={{ color: 'var(--ink-text)' }}>5</strong>{' '}
          to win.
        </p>
      </header>

      <div
        className="rounded-xl border p-4 md:p-6"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'transparent' }}
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          <span>
            Moves: <strong style={{ color: 'var(--ink-text)' }}>{g.moves}</strong>
          </span>
          <span className="text-xs">
            Keys: <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>1</kbd>–
            <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>5</kbd> pick ·{' '}
            <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>Enter</kbd> swap ·{' '}
            <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>Esc</kbd> clear ·{' '}
            <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>N</kbd> new
          </span>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <div
                className="flex shrink-0 flex-col items-center justify-center rounded-xl border px-4 py-2.5 sm:py-3"
                style={{ borderColor: 'var(--ink-accent)', backgroundColor: 'var(--ink-paper)' }}
                aria-live="polite"
                aria-label={`${currentCorrect} of 5 cans in correct position`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
                  Correct
                </span>
                <span
                  className="font-lora text-4xl font-semibold leading-none tabular-nums sm:text-5xl"
                  style={{ color: 'var(--ink-text)' }}
                  data-testid="five-can-correct-big"
                >
                  {currentCorrect}
                  <span className="text-xl font-normal sm:text-2xl" style={{ color: 'var(--ink-muted)' }}>
                    {' '}
                    / 5
                  </span>
                </span>
              </div>

              <div className="min-w-0 flex-1 touch-pan-x overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <div className="flex w-max min-w-full flex-nowrap justify-center gap-2 sm:min-w-0 sm:justify-start">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <Slot
                      key={idx}
                      idx={idx}
                      canId={canIds[idx] ?? 0}
                      selected={first === idx ? 'first' : second === idx ? 'second' : null}
                      disabled={g.won}
                      onPick={pick}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside
            className="w-full shrink-0 rounded-lg border p-3 lg:w-[200px] lg:border-l lg:pl-4"
            style={{ borderColor: 'var(--ink-border)' }}
          >
            <h2 className="mb-2 font-lora text-sm font-semibold" style={{ color: 'var(--ink-text)' }}>
              Feedback history
            </h2>
            {g.feedbackHistory.length === 0 ? (
              <p className="text-xs leading-snug" style={{ color: 'var(--ink-muted)' }}>
                Newest swap results appear on top after you press Swap.
              </p>
            ) : (
              <ul
                data-testid="five-can-feedback"
                className="scrollbar-needed max-h-[min(240px,35vh)] space-y-1.5 overflow-y-auto pr-1 text-sm"
              >
                {g.feedbackHistory.map((e, i) => (
                  <li
                    key={`${e.move}-${e.correct}-${i}`}
                    data-testid={i === 0 ? 'five-can-feedback-latest' : undefined}
                    className="flex justify-between gap-2 rounded border px-2 py-1.5"
                    style={{
                      borderColor: i === 0 ? 'var(--ink-accent)' : 'var(--ink-border)',
                      backgroundColor: i === 0 ? 'var(--ink-paper)' : 'transparent',
                    }}
                  >
                    <span style={{ color: 'var(--ink-muted)' }}>Move {e.move}</span>
                    <span className="tabular-nums font-medium" style={{ color: 'var(--ink-text)' }}>
                      {e.correct} / 5
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4" style={{ borderColor: 'var(--ink-border)' }}>
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
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            {first !== null && second === null && <>Slot {first + 1} selected — pick another.</>}
            {first !== null && second !== null && <>Ready to swap slots {first + 1} ↔ {second + 1}.</>}
          </span>
        </div>

        {g.won && (
          <div
            className="mt-5 rounded-lg border p-4 text-center"
            style={{ borderColor: 'var(--ink-accent)', backgroundColor: 'var(--ink-paper)' }}
            data-testid="five-can-won"
          >
            <p className="font-lora text-lg font-semibold" style={{ color: 'var(--ink-text)' }}>
              Solved — all five cans match the hidden order.
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
              Target order (left → right):
            </p>
            <div className="mx-auto mt-3 flex w-max max-w-full flex-nowrap justify-center gap-2 overflow-x-auto pb-1">
              {g.target.map((id) => (
                <div key={id} className="flex w-[52px] shrink-0 flex-col items-center gap-1">
                  <div className="h-[72px] w-full [&>svg]:h-full [&>svg]:w-full">
                    <FiveCanDoodle canId={id} />
                  </div>
                  <span className="text-center text-[9px] leading-tight" style={{ color: 'var(--ink-muted)' }}>
                    {CAN_BRAND_NAMES[id]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
