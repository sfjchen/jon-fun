import { generateRoomPin, validateRoomPin } from './poker'

export type Game24Status = 'waiting' | 'active' | 'intermission' | 'finished'

export const GAME24_MAX_PLAYERS = 20
export const GAME24_MAX_ROUNDS = 8
export const GAME24_ROUND_DURATION_MS = 20_000
export const GAME24_INTERMISSION_MS = 5_000

export { generateRoomPin, validateRoomPin }

export const scoreForElapsed = (elapsedMs: number): number => {
  const clamped = Math.max(0, Math.min(GAME24_ROUND_DURATION_MS, elapsedMs))
  const remainingRatio = 1 - clamped / GAME24_ROUND_DURATION_MS
  return Math.max(0, Math.round(2000 * remainingRatio))
}

