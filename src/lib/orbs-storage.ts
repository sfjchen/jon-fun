/** Browser storage for Orbs daily picks and independent archive completions. */

import { ORBS_CATEGORY_SIZE, ORBS_MAX, type OrbsCategoryId, type OrbsPick } from '@/lib/orbs'

/** Checks a stored list of picks before resuming it. */
export function validOrbsPicks(picks: unknown): picks is OrbsPick[] {
  return (
    Array.isArray(picks) && picks.length <= ORBS_MAX && picks.every((pick) => pick === 0 || pick === 1 || pick === 2)
  )
}

/** Reads saved picks without failing when storage is unavailable. */
export function readOrbsPicks(key: string): (OrbsPick | null)[] {
  try {
    const run = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!Array.isArray(run?.picks) || run.picks.length > ORBS_MAX) return []
    const picks: unknown[] = run.picks
    if (validOrbsPicks(picks.filter((pick) => pick !== null))) return picks as (OrbsPick | null)[]
  } catch {}
  return []
}

/** Names a completion for a single archive day and category. */
export function archiveKey(day: string, category: OrbsCategoryId): string {
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

/** Saves partial picks and retains any previous completion mark during a replay. */
export function saveArchivePicks(
  day: string,
  category: OrbsCategoryId,
  picks: (OrbsPick | null)[],
  score?: number,
): void {
  try {
    const key = archiveKey(day, category)
    const previous = archiveRoundDone(day, category) ? JSON.parse(localStorage.getItem(key) ?? '{}') : {}
    const mark = score === undefined ? previous : { n: score, at: Date.now() }
    localStorage.setItem(key, JSON.stringify({ ...mark, picks }))
  } catch {}
}
