/** Rules and puzzle types shared by the Orbs player, bank tooling and score verifier. */

export const ORBS_FIRST_DAY = '2026-11-21'
export const ORBS_CATEGORY_SIZE = 3
export const ORBS_BOARD_FIRST_DAY = '2026-11-27'
export const ORBS_CATEGORIES = {
  trivia: 'Arts & Culture',
  words: 'Wordplay',
  geography: 'Places',
  science: 'Nature & Science',
} as const

export const ORBS_FORMATS = {
  choice: 'Quick quiz',
  type: 'Written clues',
  match: 'Matching',
  sort: 'Sorting',
} as const
export const ORBS_MAX = Object.keys(ORBS_CATEGORIES).length * ORBS_CATEGORY_SIZE

export type OrbsCategoryId = keyof typeof ORBS_CATEGORIES
export type OrbsQuestion = { prompt: string; options: [string, string, string]; answer: 0 | 1 | 2; aliases?: string[] }
export type OrbsPick = OrbsQuestion['answer']
export type OrbsCategory = {
  id: OrbsCategoryId
  title: string
  note?: string
  format?: keyof typeof ORBS_FORMATS
  questions: OrbsQuestion[]
}
export type OrbsPuzzle = { categories: OrbsCategory[] }
export type OrbsIndex = Record<OrbsCategoryId, string[]>

/** Recognizes a category from the archive URL. */
export function isOrbsCategory(value: string | null): value is OrbsCategoryId {
  return value !== null && Object.hasOwn(ORBS_CATEGORIES, value)
}

/** Links to a past edition, optionally focused on one theme. */
export function orbsArchiveHref(day: string, category?: OrbsCategoryId): string {
  return `/games/orbs/archive/play?d=${day}${category ? `&c=${category}` : ''}`
}

/** Counts one orb for each correct pick. */
export function scoreOrbs(questions: OrbsQuestion[], picks: (number | null)[]): number {
  return picks.filter((pick, index) => pick === questions[index]?.answer).length
}

/** Converts a written answer into the same replayable pick used by the other formats. */
export function orbsWrittenPick(question: OrbsQuestion, input: string): OrbsPick {
  const normalize = (value: string) =>
    value.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase()
  const answers = [question.options[question.answer], ...(question.aliases ?? [])]
  return answers.some((answer) => normalize(answer) === normalize(input))
    ? question.answer
    : question.answer === 0
      ? 1
      : 0
}
