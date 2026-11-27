import { z } from 'zod'
import { ORB_COLORS } from '@/lib/publisher-orbs'

const text = z.string()
const optionalText = text.optional()
const texts = z.array(text)
const alias = z.union([text, z.object({ value: text, mode: z.literal('contains'), wholeWord: z.boolean().optional() })])
const aliases = z.record(text, z.array(alias))
const answer = z.union([text, z.object({ name: text, display: optionalText })])
const answers = z.array(answer)
const answerFields = {
  aliases: aliases.optional(),
  context: z.union([text, z.object({ overrides: z.object({ aliases: aliases.optional() }).optional() })]).optional(),
}
const threshold = z.number().int().positive()
const base = {
  id: text,
  title: text,
  description: text,
  explanation: optionalText,
  notice: optionalText,
  footnote: optionalText,
  starThresholds: z.tuple([threshold, threshold, threshold]),
}
const pair = z.object({ itemA: text, itemB: text, display: optionalText })
const puzzleSchema = z.discriminatedUnion('type', [
  z.object({
    ...base,
    type: z.literal('bijection'),
    pairs: z.array(pair.extend({ id: text, sortA: z.number().optional(), sortB: z.number().optional() })).min(1),
    columnA: optionalText,
    columnB: optionalText,
    neutralPairs: z.array(pair).optional(),
    expectedWrong: z.array(pair).optional(),
  }),
  z.object({
    ...base,
    type: z.literal('categorization'),
    categories: texts.min(1),
    categoryIcons: z.record(text, text).optional(),
    items: z
      .array(z.object({ id: text, text, description: optionalText, category: text, reveal: optionalText }))
      .min(1),
  }),
  z.object({
    ...base,
    ...answerFields,
    type: z.literal('themed'),
    clues: z
      .array(
        z.object({
          id: text,
          hint: text,
          answers: answers.min(1),
          reveal: optionalText,
          expectedWrong: answers.optional(),
        }),
      )
      .min(1),
    placeholder: optionalText,
  }),
  z.object({
    ...base,
    ...answerFields,
    type: z.enum(['open-ended', 'long-list']),
    answers: answers.min(1),
    neutralAnswers: answers.optional(),
    expectedWrong: answers.optional(),
    expectedWrongDefault: optionalText,
  }),
])

export type PublisherPuzzle = z.infer<typeof puzzleSchema>
export type PublisherAnswer = z.infer<typeof answer>
export type PublisherAnswerFields = Pick<Extract<PublisherPuzzle, { type: 'themed' }>, 'aliases' | 'context'>

/** Sends the fields used by the player. The source snapshot retains the full published payload. */
export function publisherOrbsPlayable(puzzles: Record<(typeof ORB_COLORS)[number], unknown>) {
  return Object.fromEntries(
    ORB_COLORS.map((color) => {
      const parsed = puzzleSchema.safeParse(puzzles[color])
      if (!parsed.success) throw new Error(`Unsupported Daily Orbs puzzle in the ${color} slot.`)
      return [color, parsed.data]
    }),
  ) as Record<(typeof ORB_COLORS)[number], PublisherPuzzle>
}
