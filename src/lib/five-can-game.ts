/** Five distinct cans as labels (analysis paper uses A–E). */
export const CAN_LABELS = ['A', 'B', 'C', 'D', 'E'] as const

/** Short parody-style names (mapped by can id 0–4). */
export const CAN_BRAND_NAMES = ['Cola', 'Pepsy', 'Spritz', 'Fantuh', 'Dr. Prepper'] as const

/** `target[i]` = which can belongs at position i (0–4). */
export type Perm5 = readonly [number, number, number, number, number]

function shuffleInPlace(a: [number, number, number, number, number]): void {
  for (let i = 4; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]!
    a[j] = t!
  }
}

export function randomPermutation(): Perm5 {
  const a: [number, number, number, number, number] = [0, 1, 2, 3, 4]
  shuffleInPlace(a)
  return a
}

/** True iff no position matches between current and target (derangement relative to target). */
export function isDerangement(current: readonly number[], target: readonly number[]): boolean {
  for (let i = 0; i < 5; i++) {
    if (current[i]! === target[i]!) return false
  }
  return true
}

/** Random arrangement with 0 cans in the correct place relative to `target`. */
export function randomDerangedStart(target: readonly number[]): Perm5 {
  const a: [number, number, number, number, number] = [0, 1, 2, 3, 4]
  for (let t = 0; t < 400; t++) {
    shuffleInPlace(a)
    const cur: [number, number, number, number, number] = [...a]
    if (isDerangement(cur, target)) {
      return cur
    }
  }
  /** Guaranteed derangement: rotate target labels one step (each position gets another can’s target). */
  const tgt = target as Perm5
  return [tgt[1]!, tgt[2]!, tgt[3]!, tgt[4]!, tgt[0]!]
}

/** Count of positions i where current[i] === target[i]. */
export function countCorrect(current: readonly number[], target: readonly number[]): number {
  let n = 0
  for (let i = 0; i < 5; i++) {
    if (current[i]! === target[i]!) n++
  }
  return n
}

export function applySwap(current: readonly number[], i: number, j: number): Perm5 {
  const next = [...current] as [number, number, number, number, number]
  const t = next[i]
  next[i] = next[j]!
  next[j] = t!
  return next
}

/** Remove can at `from`, insert at index `to` (0–4). One insertion move. */
export function applyShiftInsert(current: readonly number[], from: number, to: number): Perm5 {
  if (from === to) return current as Perm5
  const a = [...current]
  const el = a[from]!
  a.splice(from, 1)
  a.splice(to, 0, el)
  return [a[0]!, a[1]!, a[2]!, a[3]!, a[4]!]
}

/** Paper theorem: optimal positional-feedback identification (swap moves). */
export const THEORY_WORST_CASE_SWAP_MOVES = 7

/**
 * Maximum moves needed to reach any permutation from any other using one insertion
 * per move (BFS diameter on S₅). Distinct from the feedback-identification game.
 */
export const THEORY_WORST_CASE_SHIFT_SORT_MOVES = 4

/** Top-level UI mode: `swap` = swaps only; `shift` = swaps + insertion moves. */
export type FiveCanGameMode = 'swap' | 'shift'

export function permKey(p: readonly number[]): string {
  return `${p[0]},${p[1]},${p[2]},${p[3]},${p[4]}`
}

/** One legal move toward the target (used by hint). */
export type HintMove =
  | { kind: 'swap'; i: number; j: number }
  | { kind: 'shift'; from: number; to: number }

function neighborsForMode(
  mode: FiveCanGameMode,
  p: Perm5,
): Array<{ next: Perm5; move: HintMove }> {
  const out: Array<{ next: Perm5; move: HintMove }> = []
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      out.push({ next: applySwap(p, i, j), move: { kind: 'swap', i, j } })
    }
  }
  if (mode === 'shift') {
    for (let from = 0; from < 5; from++) {
      for (let to = 0; to < 5; to++) {
        if (from === to) continue
        out.push({ next: applyShiftInsert(p, from, to), move: { kind: 'shift', from, to } })
      }
    }
  }
  return out
}

/**
 * One step on a shortest path from `current` to `target` in the graph defined by `mode`
 * (swap-only vs swap + insertion). Uses full target — intended as a solver hint, not
 * feedback-optimal play.
 */
export function hintFirstMoveOnShortestPath(
  current: Perm5,
  target: Perm5,
  mode: FiveCanGameMode,
): HintMove | null {
  const ck = permKey(current)
  const tk = permKey(target)
  if (ck === tk) return null

  const q: Perm5[] = [current]
  const parent = new Map<string, { prevKey: string; move: HintMove }>()
  const seen = new Set<string>([ck])

  while (q.length) {
    const u = q.shift()!
    const uk = permKey(u)
    if (uk === tk) {
      const moves: HintMove[] = []
      let k = tk
      while (k !== ck) {
        const step = parent.get(k)
        if (!step) return null
        moves.push(step.move)
        k = step.prevKey
      }
      return moves[moves.length - 1] ?? null
    }
    for (const { next, move } of neighborsForMode(mode, u)) {
      const nk = permKey(next)
      if (!seen.has(nk)) {
        seen.add(nk)
        parent.set(nk, { prevKey: uk, move })
        q.push(next)
      }
    }
  }
  return null
}
