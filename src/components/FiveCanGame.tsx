'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiveCanDoodle } from '@/components/FiveCanDoodle'
import {
  CAN_BRAND_NAMES,
  THEORY_WORST_CASE_SHIFT_SORT_MOVES,
  THEORY_WORST_CASE_SWAP_MOVES,
  applyShiftInsert,
  applySwap,
  countCorrect,
  hintFirstMoveOnShortestPath,
  randomDerangedStart,
  randomPermutation,
  type FiveCanGameMode,
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

function Slot({
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
  const brand = CAN_BRAND_NAMES[canId] ?? 'Can'
  const sel =
    selected === 'first'
      ? 'border-[var(--ink-accent)] shadow-[inset_0_0_0_2px_var(--ink-accent)]'
      : selected === 'second'
        ? 'border-[var(--ink-muted)] shadow-[inset_0_0_0_2px_var(--ink-muted)]'
        : 'border-[var(--ink-border)]'

  return (
    <button
      type="button"
      data-testid={`five-can-slot-${idx}`}
      disabled={disabled}
      onClick={() => onPick(idx)}
      className={`flex w-[min(22vw,104px)] shrink-0 flex-col items-center justify-start rounded-xl border-2 px-1.5 pb-2 pt-1.5 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 disabled:opacity-50 sm:w-[104px] md:w-[112px] ${sel}`}
      style={{
        backgroundColor: 'var(--ink-paper)',
      }}
    >
      <span className="mb-1 text-[11px] font-medium leading-none" style={{ color: 'var(--ink-muted)' }}>
        {idx + 1}
      </span>
      <div className="h-[min(28vw,120px)] w-full sm:h-[120px] [&>svg]:h-full [&>svg]:w-full">
        <FiveCanDoodle canId={canId} />
      </div>
      <span className="mt-1.5 line-clamp-2 min-h-[2.25rem] text-center text-[11px] leading-snug sm:text-xs" style={{ color: 'var(--ink-muted)' }}>
        {brand}
      </span>
    </button>
  )
}

export default function FiveCanGame() {
  const [g, setG] = useState<GameState>(() => initialState())
  const [mode, setMode] = useState<FiveCanGameMode>('swap')
  /** In shift mode: apply a swap of the two slots vs insert-from / insert-to. */
  const [shiftMoveKind, setShiftMoveKind] = useState<'swap' | 'insert'>('insert')
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
        setSecond(null)
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

  const applyMove = useCallback(() => {
    if (g.won || first === null || second === null) return
    const next =
      mode === 'swap'
        ? applySwap(g.current, first, second)
        : shiftMoveKind === 'swap'
          ? applySwap(g.current, first, second)
          : applyShiftInsert(g.current, first, second)
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
  }, [first, second, g, mode, shiftMoveKind])

  const newGame = useCallback(() => {
    setG(initialState())
    setFirst(null)
    setSecond(null)
    setShiftMoveKind('insert')
  }, [])

  const clearSelection = useCallback(() => {
    setFirst(null)
    setSecond(null)
  }, [])

  const onModeChange = useCallback((m: FiveCanGameMode) => {
    setMode(m)
    setFirst(null)
    setSecond(null)
    if (m === 'swap') setShiftMoveKind('insert')
  }, [])

  const solverHint = !g.won ? hintFirstMoveOnShortestPath(g.current, g.target, mode) : null

  const applyHint = useCallback(() => {
    if (g.won) return
    const h = hintFirstMoveOnShortestPath(g.current, g.target, mode)
    if (!h) return
    if (h.kind === 'swap') {
      setFirst(h.i)
      setSecond(h.j)
      if (mode === 'shift') setShiftMoveKind('swap')
    } else {
      setFirst(h.from)
      setSecond(h.to)
      if (mode === 'shift') setShiftMoveKind('insert')
    }
  }, [g, mode])

  const keyCb = useRef({ pick, applyMove, newGame, clearSelection, applyHint })
  keyCb.current = { pick, applyMove, newGame, clearSelection, applyHint }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      const { pick: p, applyMove: go, newGame: ng, clearSelection: clear, applyHint: hi } = keyCb.current

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
        go()
        return
      }
      if (e.key === 'h' || e.key === 'H') {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        e.preventDefault()
        hi()
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

  const canApply = first !== null && second !== null && !g.won && first !== second

  const applyLabel =
    mode === 'swap' ? 'Swap' : shiftMoveKind === 'swap' ? 'Swap' : 'Shift'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-lora text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--ink-text)' }}>
          5 Can Sorting
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Five doodle soda cans have a hidden left-to-right order. You start with{' '}
          <strong style={{ color: 'var(--ink-text)' }}>no</strong> cans correct. After each move you only see how many
          are in the right place. Reach <strong style={{ color: 'var(--ink-text)' }}>5</strong> correct to win.
        </p>
      </header>

      <div
        className="rounded-xl border p-4 md:p-6"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'transparent' }}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              Moves: <strong style={{ color: 'var(--ink-text)' }}>{g.moves}</strong>
            </span>
            <div
              className="inline-flex rounded-lg border p-0.5"
              style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}
              role="group"
              aria-label="Move type"
            >
              <button
                type="button"
                onClick={() => onModeChange('swap')}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition"
                style={{
                  backgroundColor: mode === 'swap' ? 'var(--ink-accent)' : 'transparent',
                  color: mode === 'swap' ? '#fff' : 'var(--ink-text)',
                }}
              >
                Swap
              </button>
              <button
                type="button"
                onClick={() => onModeChange('shift')}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition"
                style={{
                  backgroundColor: mode === 'shift' ? 'var(--ink-accent)' : 'transparent',
                  color: mode === 'shift' ? '#fff' : 'var(--ink-text)',
                }}
              >
                Shift
              </button>
            </div>
            {mode === 'shift' && (
              <div
                className="inline-flex rounded-lg border p-0.5"
                style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}
                role="group"
                aria-label="Shift mode: insert vs swap"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShiftMoveKind('insert')
                    setFirst(null)
                    setSecond(null)
                  }}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium transition"
                  style={{
                    backgroundColor: shiftMoveKind === 'insert' ? 'var(--ink-accent)' : 'transparent',
                    color: shiftMoveKind === 'insert' ? '#fff' : 'var(--ink-text)',
                  }}
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShiftMoveKind('swap')
                    setFirst(null)
                    setSecond(null)
                  }}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium transition"
                  style={{
                    backgroundColor: shiftMoveKind === 'swap' ? 'var(--ink-accent)' : 'transparent',
                    color: shiftMoveKind === 'swap' ? '#fff' : 'var(--ink-text)',
                  }}
                >
                  Swap
                </button>
              </div>
            )}
          </div>
          <span className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>1</kbd>–
            <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>5</kbd> pick ·{' '}
            <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>Enter</kbd>{' '}
            apply · <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>H</kbd>{' '}
            hint · <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>Esc</kbd>{' '}
            clear · <kbd className="rounded border px-1 py-0.5" style={{ borderColor: 'var(--ink-border)' }}>N</kbd>{' '}
            new
          </span>
        </div>

        <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch xl:gap-5">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-stretch">
              <div
                className="flex shrink-0 flex-col items-center justify-center rounded-xl border px-5 py-3 lg:min-w-[7rem]"
                style={{ borderColor: 'var(--ink-accent)', backgroundColor: 'var(--ink-paper)' }}
                aria-live="polite"
                aria-label={`${currentCorrect} cans in correct position`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
                  Correct
                </span>
                <span
                  className="font-lora text-5xl font-semibold tabular-nums sm:text-6xl"
                  style={{ color: 'var(--ink-text)', lineHeight: 1 }}
                  data-testid="five-can-correct-big"
                >
                  {currentCorrect}
                </span>
              </div>

              <div className="min-w-0 flex-1 touch-pan-x overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <div className="flex h-full min-h-[200px] w-max min-w-full flex-nowrap items-stretch justify-between gap-2 sm:gap-3 md:min-w-0 md:justify-evenly">
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
            className="flex w-full shrink-0 flex-col gap-4 lg:max-w-[13.5rem] xl:w-[13.5rem]"
            style={{ color: 'var(--ink-muted)' }}
          >
            <div className="rounded-lg border p-3 text-xs leading-snug" style={{ borderColor: 'var(--ink-border)' }}>
              <p className="mb-1.5 font-lora font-semibold" style={{ color: 'var(--ink-text)' }}>
                Theory (worst case)
              </p>
              <p className="mb-2 border-b pb-2" style={{ borderColor: 'var(--ink-border)' }}>
                <strong style={{ color: 'var(--ink-text)' }}>Swap:</strong> optimal play with positional feedback only
                needs at most <strong style={{ color: 'var(--ink-text)' }}>{THEORY_WORST_CASE_SWAP_MOVES}</strong> moves to
                identify the hidden order (paper).
              </p>
              <p>
                <strong style={{ color: 'var(--ink-text)' }}>Shift mode:</strong> choose <strong>Insert</strong> (pick
                source slot then destination) or <strong>Swap</strong> (two slots). Insertion alone sorts any layout in at
                most <strong style={{ color: 'var(--ink-text)' }}>{THEORY_WORST_CASE_SHIFT_SORT_MOVES}</strong> moves
                (diameter on S₅); swaps are optional when helpful.
              </p>
            </div>

            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--ink-border)' }}>
              <h2 className="mb-2 font-lora text-sm font-semibold" style={{ color: 'var(--ink-text)' }}>
                Feedback history
              </h2>
              {g.feedbackHistory.length === 0 ? (
                <p className="text-xs leading-snug">Newest results on top after you apply a move.</p>
              ) : (
                <ul
                  data-testid="five-can-feedback"
                  className="scrollbar-needed max-h-[min(220px,32vh)] space-y-1.5 overflow-y-auto pr-1 text-sm"
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
                      <span className="tabular-nums font-semibold" style={{ color: 'var(--ink-text)' }}>
                        {e.correct}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:flex-wrap sm:items-center" style={{ borderColor: 'var(--ink-border)' }}>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              data-testid="five-can-swap"
              disabled={!canApply}
              onClick={applyMove}
              className="min-h-[44px] min-w-[120px] rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 disabled:opacity-45"
              style={{ backgroundColor: 'var(--ink-accent)' }}
            >
              {applyLabel}
            </button>
            <button
              type="button"
              data-testid="five-can-hint"
              disabled={g.won || solverHint === null}
              onClick={applyHint}
              className="min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-accent)] focus-visible:ring-offset-2 disabled:opacity-45"
              style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
              title="Shortest path to the hidden order (full state). Does not spend a move."
            >
              Hint
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
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            {mode === 'swap' && first !== null && second === null && <>Pick a second slot, then Swap.</>}
            {mode === 'swap' && first !== null && second !== null && (
              <>Swap slots {first + 1} ↔ {second + 1}.</>
            )}
            {mode === 'shift' && shiftMoveKind === 'insert' && first !== null && second === null && (
              <>Pick insert position (destination slot).</>
            )}
            {mode === 'shift' && shiftMoveKind === 'insert' && first !== null && second !== null && (
              <>Move can from slot {first + 1} to position {second + 1}.</>
            )}
            {mode === 'shift' && shiftMoveKind === 'swap' && first !== null && second === null && (
              <>Pick a second slot, then Swap.</>
            )}
            {mode === 'shift' && shiftMoveKind === 'swap' && first !== null && second !== null && (
              <>Swap slots {first + 1} ↔ {second + 1}.</>
            )}
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
            <div className="mx-auto mt-3 flex w-full max-w-2xl flex-nowrap justify-center gap-2 overflow-x-auto pb-1 sm:gap-3">
              {g.target.map((id) => (
                <div key={id} className="flex w-[72px] shrink-0 flex-col items-center gap-1 sm:w-20">
                  <div className="h-[88px] w-full [&>svg]:h-full [&>svg]:w-full">
                    <FiveCanDoodle canId={id} />
                  </div>
                  <span className="text-center text-[10px] leading-tight sm:text-[11px]" style={{ color: 'var(--ink-muted)' }}>
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
