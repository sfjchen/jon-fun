/**
 * Rules for Triples: 81 cards, each with 4 features (count, shape, color, fill) that take 1 of 3 values.
 * 3 cards form a triple when every feature is all the same or all different across them.
 * Runs on the client (solo play) and in /api/triples (rooms).
 */

import { generateRoomPin, validateRoomPin } from '@/lib/poker'
import { shuffle } from '@/lib/random'

export { generateRoomPin, validateRoomPin }

export const TRIPLES_MAX_PLAYERS = 12
export const BOARD_SIZE = 12

export type Deal = { deck: number[]; board: number[] }
export type TriplesPlayer = { id: string; name: string; score: number; misses: number }
export type TriplesClaim = { by: string; name: string; cards: number[]; ok: boolean; at: string }
export type TriplesRoom = {
  pin: string
  hostId: string
  status: 'waiting' | 'active' | 'finished'
  board: number[]
  deckCount: number
  players: TriplesPlayer[]
  lastClaim: TriplesClaim | null
  version: number
  startedAt: string | null
}

/**
 * Returns a card's 4 feature values, each 0-2: [count, shape, color, fill].
 */
export function features(card: number): [number, number, number, number] {
  return [card % 3, Math.floor(card / 3) % 3, Math.floor(card / 9) % 3, Math.floor(card / 27) % 3]
}

/**
 * Returns true when every feature is all the same or all different across the 3 cards.
 */
export function isTriple(a: number, b: number, c: number): boolean {
  if (a === b || b === c || a === c) return false
  const fa = features(a)
  const fb = features(b)
  const fc = features(c)
  return fa.every((v, i) => (v + fb[i]! + fc[i]!) % 3 === 0)
}

/**
 * Returns the first triple on the board as 3 cards, or null when there is none.
 */
export function findTriple(board: number[]): number[] | null {
  for (let i = 0; i < board.length; i++)
    for (let j = i + 1; j < board.length; j++)
      for (let k = j + 1; k < board.length; k++)
        if (isTriple(board[i]!, board[j]!, board[k]!)) return [board[i]!, board[j]!, board[k]!]
  return null
}

/**
 * Deals 3 more cards while the board has no triple and the deck has cards left.
 */
function topUp({ deck, board }: Deal): Deal {
  const d = [...deck]
  const b = [...board]
  while (!findTriple(b) && d.length) b.push(...d.splice(0, 3))
  return { deck: d, board: b }
}

/**
 * Shuffles a full deck and deals 12 cards, plus 3 at a time until a triple is showing.
 */
export function newDeal(): Deal {
  const deck = shuffle(Array.from({ length: 81 }, (_, i) => i))
  return topUp({ deck: deck.slice(BOARD_SIZE), board: deck.slice(0, BOARD_SIZE) })
}

/**
 * Removes a found triple. On a 12-card board new cards fill the same spots, on a bigger board it shrinks back.
 */
export function removeTriple({ deck, board }: Deal, cards: number[]): Deal {
  const d = [...deck]
  const refill = board.length <= BOARD_SIZE
  const b = board.flatMap((c) => (!cards.includes(c) ? [c] : refill && d.length ? [d.shift()!] : []))
  return topUp({ deck: d, board: b })
}

/**
 * Returns true when the game is over: no triple on the board and no cards left to deal.
 */
export function isOver({ deck, board }: Deal): boolean {
  return !deck.length && !findTriple(board)
}

const FEATURE_NAMES = ['count', 'shape', 'color', 'fill']

/**
 * Names the features that break a triple: 2 cards match and the 3rd differs, like ["color", "fill"].
 */
export function brokenFeatures(cards: number[]): string[] {
  const fs = cards.map(features)
  return FEATURE_NAMES.filter((_, i) => fs.reduce((s, f) => s + f[i]!, 0) % 3 !== 0)
}
