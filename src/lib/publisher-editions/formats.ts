/** Validates publisher-provided inputs for private local player development. */
import { z } from 'zod'
import { validDay } from '@/lib/daily'
import { headcountEdition } from '@/lib/headcount'

export const publisherGames = [
  'kabloom',
  'orbs',
  'chainle',
  'headcount',
  'crowdict',
  'famous',
  'plain',
  'bandle',
  'daily-roll',
  'fermi',
  'poople',
  'perceptle',
  'travle',
  'worldle',
  'maptap',
  'contexto',
  'krillion',
  'wordle',
  'connections',
  'nyt-crossword',
] as const

const day = z.string().refine(validDay)
const identifier = z.union([z.string().trim().min(1).max(120), z.number().int().nonnegative()])
const text = z.string().trim().min(1)
const https = z.url({ protocol: /^https$/ })
export const publisherGame = z.enum(publisherGames)
export type PublisherGame = z.infer<typeof publisherGame>

const edition = z.object({
  format: z.literal('publisher-edition/v1'),
  game: publisherGame,
  editionId: identifier,
  sourceDate: day,
  sourceUrl: https,
  scoringVersion: text.optional(),
  originalDate: day.optional(),
  payload: z.record(z.string(), z.unknown()),
})
export type PublisherEdition = z.infer<typeof edition>

const kabloomEdition = z.looseObject({
  category: text,
  readingMs: z.number().int().nonnegative(),
  answerMs: z.number().int().positive(),
  answers: z.array(z.looseObject({ id: text, label: text, aliases: z.array(text) })).min(1),
  rounds: z.array(z.looseObject({ prompt: text, accepted: z.array(text).nonempty() })).length(7),
})
export type KabloomEdition = z.infer<typeof kabloomEdition>

const fermiEdition = z.looseObject({
  rounds: z
    .array(
      z.looseObject({
        prompt: text,
        unit: text,
        answer: z.number().positive(),
        reference: https.optional(),
      }),
    )
    .length(3),
})

const chainleAnswer = z.looseObject({ word: text, points: z.number().int().min(0).max(1000) })
const chainleEdition = z.looseObject({
  date: day,
  pairs: z
    .array(
      z.looseObject({
        anchors: z.array(text),
        answers: z.array(chainleAnswer).nonempty(),
        accepted: z.array(chainleAnswer),
      }),
    )
    .length(5)
    .refine((pairs) => pairs.every((pair, i) => pair.anchors.length === [2, 2, 2, 3, 1][i])),
})
const orbsEdition = z.looseObject({
  dateKey: day,
  state: z.enum(['ready', 'deja-vu']).optional(),
  originalDate: day.nullish(),
  puzzles: z.record(z.enum(['orange', 'green', 'blue', 'purple']), z.looseObject({ id: text, type: text })),
})

/** Ensures all seven rounds have declared answers, with aliases attached to a single canonical answer. */
function validateKabloom(value: unknown) {
  const climb = kabloomEdition.parse(value)
  const ids = new Set(climb.answers.map(({ id }) => id))
  if (
    ids.size !== climb.answers.length ||
    climb.rounds.some(
      (round) => new Set(round.accepted).size !== round.accepted.length || round.accepted.some((id) => !ids.has(id)),
    )
  )
    throw new Error('Kabloom has duplicate or undeclared answer IDs')
}

/** Retains the exact supplied payload and checks its embedded date where the source exposes one. */
export function validatePublisherEdition(game: PublisherGame, sourceDate: string, value: unknown): PublisherEdition {
  const result = edition.parse(value)
  if (result.game !== game || result.sourceDate !== sourceDate)
    throw new Error('Publisher returned a different edition')
  const { payload } = result
  if (game === 'kabloom') validateKabloom(payload)
  if (game === 'fermi') fermiEdition.parse(payload)
  if (game === 'headcount') {
    const party = headcountEdition.parse(payload.party ?? payload)
    if (party.date !== sourceDate || String(party.number) !== String(result.editionId)) {
      throw new Error('The nested Headcount party has a different date or edition number')
    }
  }
  if (game === 'chainle' && chainleEdition.parse(payload).date !== sourceDate) {
    throw new Error('The Chainle puzzle has a different date')
  }
  if (game === 'orbs') {
    const orbs = orbsEdition.parse(payload)
    if (
      orbs.dateKey !== sourceDate ||
      result.originalDate !== (orbs.originalDate ?? undefined) ||
      (orbs.state === 'deja-vu' && (!orbs.originalDate || orbs.originalDate >= sourceDate))
    ) {
      throw new Error('The Orbs edition date or repeat origin does not match')
    }
  }
  return result
}

/** Returns Fermi's unrounded error factor for a positive guess. */
export function fermiErrorFactor(guess: number, answer: number): number {
  if (!Number.isFinite(guess) || guess <= 0 || !Number.isFinite(answer) || answer <= 0) {
    throw new Error('Fermi scores require positive finite values')
  }
  return Math.max(guess, answer) / Math.min(guess, answer)
}
