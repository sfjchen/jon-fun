import type { PublisherAnswer as Answer, PublisherAnswerFields, PublisherPuzzle } from '@/lib/daily/publisher-orbs-play'

export type { PublisherPuzzle } from '@/lib/daily/publisher-orbs-play'

export const PUBLISHER_ORBS_FIRST_DAY = '2026-04-17'
export const ORB_COLORS = ['orange', 'green', 'blue', 'purple'] as const
export type OrbColor = (typeof ORB_COLORS)[number]

export type PublisherOrbsEdition = {
  day: string
  originalDate?: string | null
  playable: Record<OrbColor, PublisherPuzzle>
}

export const answerText = (answer: Answer) => (typeof answer === 'string' ? answer : (answer.display ?? answer.name))
const answerName = (answer: Answer) => (typeof answer === 'string' ? answer : answer.name)

function normalizedAnswer(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\p{M}'’]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Matches the published name or an explicitly accepted spelling. */
export function findOrbsAnswer(guess: string, answers: Answer[], puzzle: PublisherAnswerFields) {
  const key = normalizedAnswer(guess)
  if (!key) return -1
  const overrides = typeof puzzle.context === 'object' ? puzzle.context.overrides?.aliases : undefined
  const aliasesFor = (name: string) => [
    ...(puzzle.aliases && Object.hasOwn(puzzle.aliases, name) ? (puzzle.aliases[name] ?? []) : []),
    ...(overrides && Object.hasOwn(overrides, name) ? (overrides[name] ?? []) : []),
  ]
  const exact = answers.findIndex((answer) => normalizedAnswer(answerName(answer)) === key)
  if (exact >= 0) return exact
  const alternative = answers.findIndex((answer) =>
    aliasesFor(answerName(answer)).some((alias) => typeof alias === 'string' && normalizedAnswer(alias) === key),
  )
  if (alternative >= 0) return alternative
  return answers.findIndex((answer) =>
    aliasesFor(answerName(answer)).some((alias) => {
      if (typeof alias === 'string') return false
      const part = normalizedAnswer(alias.value)
      return !!part && (alias.wholeWord ? ` ${key} `.includes(` ${part} `) : key.includes(part))
    }),
  )
}

export function orbsOrbCount(puzzle: PublisherPuzzle, correct: number) {
  return puzzle.starThresholds.filter((threshold) => correct >= threshold).length
}
