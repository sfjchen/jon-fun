/**
 * Plays and replays the Kabloom climb from a publisher edition: answer matching with spelling suggestions, the
 * per-round reading and answer clocks, the 1-use rule for answers, and the score, which is the rounds cleared.
 * The browser and the server's score check share it, so both judge a run the same way.
 */

import { answerKey, editDistance } from '@/lib/krillion'
import type { KabloomEdition } from '@/lib/publisher-editions/formats'

export const KABLOOM_ROUNDS = 7
export type KabloomPuzzle = Pick<KabloomEdition, 'category' | 'readingMs' | 'answerMs' | 'answers' | 'rounds'> & {
  date: string
  editionId: string | number
}
/** A cleared round: the canonical answer ID and the answer clock's elapsed milliseconds when it was sent. */
export type KabloomMove = { id: string; ms: number }
/** A stored run. `start` is when the current round's reading clock began, null before the climb starts. */
export type KabloomRun = { moves: KabloomMove[]; start: number | null; over: boolean }
export type KabloomVerdict =
  | { kind: 'clear'; id: string }
  | { kind: 'spent' | 'miss'; id: string }
  | { kind: 'suggest'; id: string; label: string }
  | { kind: 'unknown' }

/**
 * Judges typed text for a round. An exact normalized label or alias picks its answer. Otherwise, from 5 letters,
 * the closest label or alias within min(3, 0.28 × its length) edits comes back as a suggestion, which counts once
 * the player sends it again (`confirm`). A picked answer clears the round when the round accepts it and the run has
 * not used it.
 */
export function judgeKabloom(
  puzzle: KabloomPuzzle,
  round: number,
  used: string[],
  text: string,
  confirm = false,
): KabloomVerdict {
  const key = answerKey(text)
  if (!key) return { kind: 'unknown' }
  const names = puzzle.answers.flatMap((a) => [a.label, ...a.aliases].map((n) => ({ a, key: answerKey(n) })))
  let hit = names.find((n) => n.key === key)?.a
  if (!hit && key.replaceAll(' ', '').length >= 5) {
    let best = 4
    for (const n of names) {
      const max = Math.min(3, Math.floor(n.key.length * 0.28))
      const d = max ? editDistance(key, n.key, max) : 4
      if (d <= max && d < best) [best, hit] = [d, n.a]
    }
    if (hit && !confirm) return { kind: 'suggest', id: hit.id, label: hit.label }
  }
  if (!hit) return { kind: 'unknown' }
  if (used.includes(hit.id)) return { kind: 'spent', id: hit.id }
  return { kind: puzzle.rounds[round]?.accepted.includes(hit.id) ? 'clear' : 'miss', id: hit.id }
}

/**
 * Splits a round's wall-clock time into what is left of the reading and answer clocks.
 */
export function kabloomClock(puzzle: KabloomPuzzle, start: number, now: number) {
  const reading = Math.max(0, start + puzzle.readingMs - now)
  return { reading, left: reading ? puzzle.answerMs : Math.max(0, start + puzzle.readingMs + puzzle.answerMs - now) }
}

/**
 * Replays cleared rounds in order and returns the score, or why the moves are not a legal climb: each answer must be
 * accepted by its round, used once, and sent within the answer clock. Fewer than 7 moves is a climb the clock ended.
 */
export function replayKabloom(puzzle: KabloomPuzzle, moves: KabloomMove[]): number | string {
  if (moves.length > puzzle.rounds.length) return 'Too many Kabloom rounds'
  for (const [i, { id, ms }] of moves.entries()) {
    if (!Number.isInteger(ms) || ms < 0 || ms > puzzle.answerMs) return 'A Kabloom answer was sent after its clock'
    if (moves.findIndex((m) => m.id === id) !== i) return 'A Kabloom answer was used twice'
    if (!puzzle.rounds[i]!.accepted.includes(id)) return 'A Kabloom answer does not fit its round'
  }
  return moves.length
}
