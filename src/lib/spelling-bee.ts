/**
 * Implements the Spelling Bee rules: scoring, ranks, entry checks, hints and the daily puzzle pick.
 * Word and puzzle data are built by scripts/build-spelling-bee.py into public/spelling-bee/.
 * A puzzle id is 7 letters, center letter first, then the 6 outer letters.
 */

export type Puzzle = { id: string; center: string; outer: string[]; answers: string[]; pangrams: string[]; max: number }

export const RANKS: [string, number][] = [
  ['Beginner', 0],
  ['Good Start', 0.02],
  ['Moving Up', 0.05],
  ['Good', 0.08],
  ['Solid', 0.15],
  ['Nice', 0.25],
  ['Great', 0.4],
  ['Amazing', 0.5],
  ['Genius', 0.7],
  ['Queen Bee', 1],
]

/**
 * Returns whether w uses all 7 letters.
 */
export const isPangram = (w: string) => new Set(w).size === 7

/**
 * Scores a word: 1 point for 4 letters, else 1 per letter, plus 7 for a pangram.
 */
export const score = (w: string) => (w.length === 4 ? 1 : w.length) + (isPangram(w) ? 7 : 0)

/** Published pangrams can be listed separately in older snapshots. */
export function includePublishedPangrams<T extends Puzzle>(puzzle: T): T {
  if (puzzle.pangrams.every((word) => puzzle.answers.includes(word))) return puzzle
  const answers = [...new Set([...puzzle.answers, ...puzzle.pangrams])].sort()
  return { ...puzzle, answers, max: answers.reduce((sum, word) => sum + score(word), 0) }
}

/**
 * Returns the minimum score of every rank for a puzzle max score.
 */
export const rankMins = (max: number) => RANKS.map(([n, p]) => [n, Math.round(p * max)] as [string, number])

/**
 * Returns the index of the rank reached with pts points.
 */
export function rankIdx(pts: number, max: number) {
  const mins = rankMins(max)
  let i = 0
  mins.forEach(([, m], j) => {
    if (pts >= m) i = j
  })
  return i
}

/**
 * Builds a puzzle from its id and the full word list.
 */
export function makePuzzle(id: string, words: string[]): Puzzle {
  const set = new Set(id)
  const center = id.charAt(0)
  const answers = words.filter((w) => w.includes(center) && [...w].every((c) => set.has(c)))
  return {
    id,
    center,
    outer: id.slice(1).split(''),
    answers,
    pangrams: answers.filter(isPangram),
    max: answers.reduce((s, w) => s + score(w), 0),
  }
}

/**
 * Checks an entry and returns an error message, or null when it is a new valid answer.
 */
export function check(entry: string, pz: Puzzle, found: string[]): string | null {
  if (entry.length < 4) return 'Too short'
  if ([...entry].some((c) => !pz.id.includes(c))) return 'Bad letters'
  if (!entry.includes(pz.center)) return 'Missing center letter'
  if (found.includes(entry)) return 'Already found'
  if (!pz.answers.includes(entry)) return 'Not in word list'
  return null
}

/**
 * Returns the praise toast for a newly found word.
 */
export const praise = (w: string) =>
  isPangram(w) ? 'Pangram!' : w.length === 4 ? 'Good!' : w.length < 7 ? 'Nice!' : 'Awesome!'

/**
 * Builds the hint grid (first letter x word length counts) and two-letter start counts for the remaining words,
 * or for all answers when left is the full list.
 */
export function hints(words: string[]) {
  const lens = [...new Set(words.map((w) => w.length))].sort((a, b) => a - b)
  const grid: Record<string, Record<number, number>> = {}
  const two: Record<string, number> = {}
  words.forEach((w) => {
    const row = (grid[w.charAt(0)] ??= {})
    row[w.length] = (row[w.length] ?? 0) + 1
    two[w.slice(0, 2)] = (two[w.slice(0, 2)] ?? 0) + 1
  })
  return { lens, grid, two }
}
