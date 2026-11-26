/** Browser storage for Orbs daily picks and independent archive completions. */

import { ORBS_CATEGORY_SIZE, ORBS_MAX, type OrbsCategoryId } from '@/lib/orbs'

/** Checks a stored list of picks before resuming it. */
export function validOrbsPicks(picks: unknown): picks is number[] {
  return (
    Array.isArray(picks) && picks.length <= ORBS_MAX && picks.every((pick) => pick === 0 || pick === 1 || pick === 2)
  )
}

/** Reads a daily run without failing when storage is unavailable. */
export function readOrbsPicks(key: string): number[] {
  try {
    const run = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (validOrbsPicks(run?.picks)) return run.picks
  } catch {}
  return []
}

/** Names a completion for a single archive day and category. */
function archiveKey(day: string, category: OrbsCategoryId): string {
  return `sfjc_orbs_archive:${day}:${category}`
}

/** Checks whether this device finished the archive round. */
export function archiveRoundDone(day: string, category: OrbsCategoryId): boolean {
  try {
    const run = JSON.parse(localStorage.getItem(archiveKey(day, category)) ?? 'null')
    return Number.isInteger(run?.n) && run.n >= 0 && run.n <= ORBS_CATEGORY_SIZE && Number.isFinite(run.at)
  } catch {
    return false
  }
}

/** Keeps archive completions on this device. */
export function saveArchiveRound(day: string, category: OrbsCategoryId, score: number): void {
  try {
    localStorage.setItem(archiveKey(day, category), JSON.stringify({ n: score, at: Date.now() }))
  } catch {}
}
