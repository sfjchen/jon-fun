/** Browser storage for practice plays of the sfjc.dev Orbs bank. */

import { ORBS_CATEGORY_SIZE, type OrbsCategory, type OrbsCategoryId } from '@/lib/orbs'
import { isOrbsRound, legacyOrbsPicks, replayOrbsRound, type OrbsRoundMoves } from '@/lib/orbs-run'

type Stored = { picks?: unknown; round?: unknown; n?: number; at?: number }

/** Reads one storage entry without requiring storage to be available. */
function read(key: string): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as Stored | null
  } catch {
    return null
  }
}

/** Saves progress without interrupting play if storage is unavailable. */
function write(key: string, value: Stored): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

/** Names one independent archive play. */
function archiveKey(day: string, category: OrbsCategoryId): string {
  return `sfjc_orbs_archive:${day}:${category}`
}

/** Checks whether this device previously finished the archive round. */
export function archiveRoundDone(day: string, category: OrbsCategoryId): boolean {
  const saved = read(archiveKey(day, category))
  return (
    typeof saved?.n === 'number' &&
    Number.isInteger(saved.n) &&
    saved.n >= 0 &&
    saved.n <= ORBS_CATEGORY_SIZE &&
    Number.isFinite(saved.at)
  )
}

/** Restores a theme from either the full archive edition or a one-theme replay. */
export function readOrbsArchive(day: string, category: OrbsCategory): OrbsRoundMoves {
  const saved = read(archiveKey(day, category.id))
  if (isOrbsRound(saved?.round) && replayOrbsRound(category, saved.round)) return saved.round
  return { legacy: legacyOrbsPicks(saved?.picks).slice(0, category.questions.length), attempts: [] }
}

/** Keeps an existing archive mark when starting over. */
export function saveOrbsArchive(day: string, category: OrbsCategoryId, round: OrbsRoundMoves, score?: number): void {
  const key = archiveKey(day, category)
  const previous = read(key)
  write(key, score === undefined ? { ...previous, picks: undefined, round } : { round, n: score, at: Date.now() })
}
