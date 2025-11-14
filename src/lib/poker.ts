export type BettingAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in'

export interface Card {
  rank: string
  suit: string
}

export interface Player {
  id: string
  name: string
  chips: number
  position: number
  isActive: boolean
  isAllIn: boolean
  currentBet: number
  holeCards: Card[] | null
  hasFolded: boolean
  hasActed: boolean
}

export function generateRoomPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export function validateRoomPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

