import type { Edition } from './daily/chainle'

export function chainlePoints(pair: Edition['pairs'][number], guess: string): number {
  return (
    [...pair.answers, ...pair.accepted].find((answer) => answer.word.toLowerCase() === guess.trim().toLowerCase())
      ?.points ?? 0
  )
}
