import { isTriple } from '@/lib/triples'
export function allSets(board: number[]): number[][] {
  const sets: number[][] = []
  for (let i = 0; i < board.length; i++)
    for (let j = i + 1; j < board.length; j++)
      for (let k = j + 1; k < board.length; k++)
        if (isTriple(board[i]!, board[j]!, board[k]!)) sets.push([board[i]!, board[j]!, board[k]!])
  return sets
}
/** A reproducible local daily puzzle with exactly six sets in twelve distinct cards. */
export function dailySetBoard(day: string): number[] {
  let seed = 2166136261
  for (const c of `sfjc-set-v1:${day}`) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let n = seed
    n = Math.imul(n ^ (n >>> 15), n | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
  for (let attempt = 0; attempt < 10000; attempt++) {
    const deck = Array.from({ length: 81 }, (_, i) => i)
    for (let i = 80; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j]!, deck[i]!]
    }
    const board = deck.slice(0, 12)
    if (allSets(board).length === 6) return board
  }
  throw Error('Could not generate a daily SET board')
}
export function setKey(cards: number[]): string {
  return [...cards].sort((a, b) => a - b).join(',')
}
