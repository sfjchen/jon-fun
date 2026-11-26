/** Rules and puzzle types shared by the Orbs player, bank tooling and score verifier. */

export const ORBS_FIRST_DAY = '2026-11-21'
export const ORBS_CATEGORY_SIZE = 3
export const ORBS_CATEGORIES = { trivia: 'Trivia', words: 'Words', geography: 'Geography', science: 'Science' } as const
export const ORBS_MAX = Object.keys(ORBS_CATEGORIES).length * ORBS_CATEGORY_SIZE

export type OrbsCategoryId = keyof typeof ORBS_CATEGORIES
export type OrbsQuestion = { prompt: string; options: [string, string, string]; answer: 0 | 1 | 2 }
export type OrbsCategory = { id: OrbsCategoryId; title: string; questions: OrbsQuestion[] }
export type OrbsPuzzle = { categories: OrbsCategory[] }
export type OrbsIndex = Record<OrbsCategoryId, string[]>

/** Recognizes a category from the archive URL. */
export function isOrbsCategory(value: string | null): value is OrbsCategoryId {
  return value !== null && Object.hasOwn(ORBS_CATEGORIES, value)
}

/** Counts one orb for each correct pick. */
export function scoreOrbs(questions: OrbsQuestion[], picks: number[]): number {
  return picks.filter((pick, index) => pick === questions[index]?.answer).length
}
