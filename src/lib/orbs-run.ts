/** Replays a practice round of the sfjc.dev Orbs bank from its saved moves. */

import { ORBS_CATEGORY_SIZE, ORBS_MAX, type OrbsCategory, type OrbsPick } from '@/lib/orbs'

export const ORBS_LIVES = 3

type Attempt = { clue: number; pick: OrbsPick }
export type OrbsRoundMoves = { legacy: (OrbsPick | null)[]; attempts: Attempt[] }
export type OrbsRoundState = { locked: (OrbsPick | null)[]; score: number; lives: number; done: boolean }

/** Checks single-choice indices shared by all puzzle formats. */
function isPick(value: unknown): value is OrbsPick {
  return value === 0 || value === 1 || value === 2
}

/** Accepts older local runs, including partial runs from either previous UI. */
export function legacyOrbsPicks(value: unknown): (OrbsPick | null)[] {
  return Array.isArray(value) && value.length <= ORBS_MAX && value.every((pick) => pick === null || isPick(pick))
    ? value
    : []
}

/** Checks the shape and maximum size of one puzzle's recorded moves. */
export function isOrbsRound(value: unknown): value is OrbsRoundMoves {
  if (!value || typeof value !== 'object' || !('legacy' in value) || !('attempts' in value)) return false
  return (
    Array.isArray(value.legacy) &&
    value.legacy.length <= ORBS_CATEGORY_SIZE &&
    value.legacy.every((pick) => pick === null || isPick(pick)) &&
    Array.isArray(value.attempts) &&
    value.attempts.length <= ORBS_CATEGORY_SIZE + ORBS_LIVES - 1 &&
    value.attempts.every(
      (attempt) =>
        attempt &&
        Number.isInteger(attempt.clue) &&
        attempt.clue >= 0 &&
        attempt.clue < ORBS_CATEGORY_SIZE &&
        isPick(attempt.pick),
    )
  )
}

/** Restores prior locked picks, then applies new attempts until all clues are locked or lives reach zero. */
export function replayOrbsRound(category: OrbsCategory, round: OrbsRoundMoves): OrbsRoundState | null {
  const questions = category.questions
  const locked = questions.map((_, index) => round.legacy[index] ?? null)
  let score = 0
  let lives = ORBS_LIVES
  const used = new Set<OrbsPick>()
  locked.forEach((pick, index) => {
    if (pick === null) return
    if (pick === questions[index]!.answer) {
      score++
      used.add(pick)
    } else lives--
  })

  for (const { clue, pick } of round.attempts) {
    const question = questions[clue]
    if (!question || locked[clue] !== null || lives <= 0 || (category.format === 'match' && used.has(pick))) return null
    if (pick === question.answer) {
      locked[clue] = pick
      used.add(pick)
      score++
    } else lives--
  }
  return { locked, score, lives, done: lives === 0 || locked.every((pick) => pick !== null) }
}
