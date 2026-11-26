/** Browser storage for Orbs daily plays and independent archive plays. */

import { ORBS_CATEGORY_SIZE, ORBS_MAX, type OrbsCategory, type OrbsCategoryId, type OrbsPuzzle } from '@/lib/orbs'
import {
  isOrbsMoveSet,
  isOrbsRound,
  legacyOrbsPicks,
  replayOrbsDay,
  replayOrbsRound,
  splitOrbsPicks,
  type OrbsRoundMoves,
} from '@/lib/orbs-run'

type Stored = { picks?: unknown; round?: unknown; rounds?: unknown; complete?: unknown; n?: number; at?: number }

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

/** Restores checked daily moves, with support for older flat picks. */
export function readOrbsDaily(key: string, puzzle: OrbsPuzzle): OrbsRoundMoves[] {
  const saved = read(key)
  const picks = legacyOrbsPicks(saved?.picks)
  if (isOrbsMoveSet(saved) && replayOrbsDay(puzzle, saved)) return saved.rounds
  return splitOrbsPicks(puzzle, picks)
}

/** Saves the daily run and the quick completion flag used by the archive list. */
export function saveOrbsDaily(key: string, rounds: OrbsRoundMoves[], complete: boolean): void {
  write(key, { rounds, complete })
}

/** Reads the archive list's completion flag from either storage format. */
export function orbsDailyDone(key: string): boolean {
  const saved = read(key)
  const old = legacyOrbsPicks(saved?.picks)
  return saved?.complete === true || (old.length === ORBS_MAX && old.every((pick) => pick !== null))
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
