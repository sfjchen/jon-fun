/**
 * Rules shared by the Daily Orbs player and the score check: answer matching, a round's size and end, and the replay
 * of a round's attempts into its correct answers, misses and orbs.
 */

import type { PublisherAnswer as Answer, PublisherAnswerFields, PublisherPuzzle } from '@/lib/daily/publisher-orbs-play'

export type { PublisherPuzzle } from '@/lib/daily/publisher-orbs-play'

export const PUBLISHER_ORBS_FIRST_DAY = '2026-04-17'
/** The first day whose publisher edition ranks. Earlier Orbs scores came from the sfjc.dev bank. */
export const PUBLISHER_ORBS_RANKED_FROM = '2026-11-26'
export const ORB_LIVES = 3
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

/**
 * Counts the orbs a round earns for its correct answers.
 */
export function orbsOrbCount(puzzle: PublisherPuzzle, correct: number) {
  return puzzle.starThresholds.filter((threshold) => correct >= threshold).length
}

/**
 * 1 attempt in a round: a matching pair `[left, right]`, a sorted item `[item id, category]`, a clue answer
 * `[clue id, guess]`, a list guess `[guess]`, or `[]` to end a long list early.
 */
export type OrbsMove = string[]
export type OrbsMoves = Record<OrbColor, OrbsMove[]>
/** A round's state. A run saved before attempts were kept has no `moves` and cannot rank. */
export type OrbsRun = { correct: string[]; misses: number; ended?: boolean; moves?: OrbsMove[] }

/**
 * Counts the answers that complete a round.
 */
export function orbsSize(puzzle: PublisherPuzzle) {
  switch (puzzle.type) {
    case 'bijection':
      return puzzle.pairs.length
    case 'categorization':
      return puzzle.items.length
    case 'themed':
      return puzzle.clues.length
    case 'long-list':
      return Math.min(puzzle.answers.length, puzzle.starThresholds[2])
    case 'open-ended':
      return puzzle.answers.length
  }
}

/**
 * Tells whether a round is over: every answer found, the lives spent, or a long list ended by the player.
 */
export function orbsDone(puzzle: PublisherPuzzle, run: OrbsRun) {
  return run.correct.length >= orbsSize(puzzle) || run.misses >= ORB_LIVES || !!run.ended
}

/**
 * Judges 1 attempt against the answers still open. Returns the id of the answer it finds (null for a miss), the
 * publisher's feedback line, and whether a miss is free. Returns null for an attempt the round cannot take.
 */
export function judgeOrbs(
  puzzle: PublisherPuzzle,
  correct: string[],
  move: OrbsMove,
): { id: string | null; message: string; neutral?: boolean } | null {
  const [first, second] = move
  if (first === undefined) return null
  if (puzzle.type === 'bijection') {
    if (second === undefined) return null
    const matches = (pair: { itemA: string; itemB: string }) => pair.itemA === first && pair.itemB === second
    const pair = puzzle.pairs.find((entry) => !correct.includes(entry.id) && matches(entry))
    const neutral = puzzle.neutralPairs?.find(matches)
    const wrong = puzzle.expectedWrong?.find(matches)
    return {
      id: pair?.id ?? null,
      message:
        pair?.display ?? neutral?.display ?? wrong?.display ?? (pair ? 'Match found.' : 'Try a different match.'),
      neutral: !!neutral,
    }
  }
  if (puzzle.type === 'categorization') {
    const item = puzzle.items.find((entry) => entry.id === first && !correct.includes(entry.id))
    if (!item || second === undefined) return null
    return item.category === second
      ? { id: item.id, message: item.reveal ?? 'Correct category.' }
      : { id: null, message: 'Try a different category.' }
  }
  if (puzzle.type === 'themed') {
    const clue = puzzle.clues.find((entry) => entry.id === first && !correct.includes(entry.id))
    if (!clue || second === undefined) return null
    const found = findOrbsAnswer(second, clue.answers, puzzle)
    if (found >= 0) return { id: clue.id, message: clue.reveal ?? answerText(clue.answers[found]!) }
    const unexpected = clue.expectedWrong ?? []
    const wrong = findOrbsAnswer(second, unexpected, puzzle)
    return { id: null, message: wrong >= 0 ? answerText(unexpected[wrong]!) : 'Try another answer.' }
  }
  const found = findOrbsAnswer(first, puzzle.answers, puzzle)
  if (found >= 0) return { id: String(found), message: answerText(puzzle.answers[found]!) }
  const neutral = puzzle.neutralAnswers ?? []
  const neutralIndex = findOrbsAnswer(first, neutral, puzzle)
  if (neutralIndex >= 0) return { id: null, message: answerText(neutral[neutralIndex]!), neutral: true }
  const wrong = puzzle.expectedWrong ?? []
  const wrongIndex = findOrbsAnswer(first, wrong, puzzle)
  return {
    id: null,
    message: wrongIndex >= 0 ? answerText(wrong[wrongIndex]!) : (puzzle.expectedWrongDefault ?? 'Try another answer.'),
  }
}

/**
 * Applies 1 attempt to a round and returns the new state with the publisher's feedback line, or null when the round
 * is over or cannot take the attempt. An answer found twice and a free miss change nothing. A long list has no lives.
 */
export function playOrbs(
  puzzle: PublisherPuzzle,
  run: OrbsRun,
  move: OrbsMove,
): { run: OrbsRun; message: string } | null {
  if (orbsDone(puzzle, run)) return null
  const moves = run.moves && [...run.moves, move]
  const next = (change: Partial<OrbsRun>) => ({ ...run, ...change, ...(moves && { moves }) })
  if (!move.length) return puzzle.type === 'long-list' ? { run: next({ ended: true }), message: '' } : null
  const result = judgeOrbs(puzzle, run.correct, move)
  if (!result) return null
  const { id, message, neutral } = result
  if (id !== null)
    return run.correct.includes(id)
      ? { run, message: 'You already found that answer.' }
      : { run: next({ correct: [...run.correct, id] }), message }
  return { run: neutral || puzzle.type === 'long-list' ? run : next({ misses: run.misses + 1 }), message }
}

/**
 * Replays a round's attempts from an empty round. Returns null when any attempt is not a legal one.
 */
export function replayOrbs(puzzle: PublisherPuzzle, moves: OrbsMove[]): OrbsRun | null {
  let run: OrbsRun = { correct: [], misses: 0, moves: [] }
  for (const move of moves) {
    const next = playOrbs(puzzle, run, move)
    if (!next) return null
    run = next.run
  }
  return run
}
