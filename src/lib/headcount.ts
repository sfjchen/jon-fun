import { z } from 'zod'

const choices = z
  .object({
    type: z.enum(['split', 'ranking', 'underdog', 'pie']),
    text: z.string(),
    options: z.array(z.string()).min(2).max(4),
    crowd: z.array(z.number().min(0).max(100)).min(2).max(4),
  })
  .refine((q) => q.options.length === q.crowd.length)
const typical = z.object({
  type: z.literal('typical'),
  text: z.string(),
  unit: z.string().optional(),
  median: z.number(),
})
export const headcountEdition = z.object({
  date: z.string(),
  number: z.number().int().positive(),
  questions: z.array(z.union([choices, typical])).length(5),
})
export type Party = z.infer<typeof headcountEdition>
export type Question = Party['questions'][number]
export type Guess = number[]
export const rooms = ['Kitchen', 'Living Room', 'Backyard', 'Basement', 'Rooftop']
const bounded = (points: number) => Math.max(0, Math.min(20, Math.round(points)))

export function roomPoints(q: Question, guess: Guess): number | null {
  const first = guess[0]
  if (first === undefined || !guess.every(Number.isFinite)) return null
  if (q.type === 'typical') {
    if (guess.length !== 1 || first < 0) return null
    const a = first + 1,
      b = Math.abs(q.median) + 1
    const ratio = Math.max(a, b) / Math.min(a, b)
    return bounded(20 * (1 - Math.log(ratio / 1.15) / Math.log(5 / 1.15)))
  }
  if (!guess.every(Number.isInteger)) return null
  if (q.type === 'split')
    return guess.length === 1 && first >= 0 && first <= 100
      ? bounded(20 - Math.max(0, Math.abs(first - q.crowd[0]!) - 3) / 2.4)
      : null
  if (q.type === 'underdog') {
    if (guess.length !== 1 || q.crowd[first] === undefined) return null
    const gap = q.crowd[first]! - Math.min(...q.crowd)
    return gap <= 2 ? 20 : bounded(20 - gap)
  }
  if (guess.length !== q.options.length) return null
  if (q.type === 'pie') {
    if (guess.some((x) => x < 0) || guess.reduce((a, b) => a + b, 0) !== 100) return null
    const misplaced = guess.reduce((sum, x, i) => sum + Math.abs(x - q.crowd[i]!), 0) / 2
    return bounded(20 - Math.max(0, misplaced - 4) / 2)
  }
  if (new Set(guess).size !== guess.length || guess.some((x) => q.crowd[x] === undefined)) return null
  const order = q.crowd.map((_, i) => i).sort((a, b) => q.crowd[b]! - q.crowd[a]!)
  return guess.reduce((sum, option, position) => {
    const distances = order.flatMap((v, i) =>
      Math.abs(q.crowd[v]! - q.crowd[option]!) <= 2 ? [Math.abs(i - position)] : [],
    )
    const distance = Math.min(...distances)
    return sum + (distance === 0 ? 5 : distance === 1 ? 3 : 0)
  }, 0)
}
