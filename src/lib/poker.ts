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

export interface SeatPlayer {
  position: number
  has_folded?: boolean
  is_all_in?: boolean
  has_acted?: boolean
  current_bet?: number
  chips?: number
}

export const BETTING_ROUNDS = ['pre-flop', 'flop', 'turn', 'river'] as const
export type BettingRound = (typeof BETTING_ROUNDS)[number]

export function generateRoomPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export function validateRoomPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

export function sortedSeatPositions(players: { position: number }[]): number[] {
  return [...players].map((p) => p.position).sort((a, b) => a - b)
}

export function nextSeat(current: number, seats: number[]): number {
  if (seats.length === 0) return -1
  const sorted = [...seats].sort((a, b) => a - b)
  const idx = sorted.indexOf(current)
  const nextIdx = idx === -1 ? 0 : (idx + 1) % sorted.length
  return sorted[nextIdx]!
}

/** First occupied seat strictly after `afterPos`, wrapping clockwise. */
export function firstSeatAfter(afterPos: number, seats: number[]): number {
  if (seats.length === 0) return -1
  const sorted = sortedSeatPositions(seats.map((s) => ({ position: s })))
  for (const pos of sorted) {
    if (pos > afterPos) return pos
  }
  return sorted[0]!
}

export function canPlayerAct(p: SeatPlayer): boolean {
  return !p.has_folded && !p.is_all_in
}

export function applyPendingUpdate(
  p: SeatPlayer,
  pending?: Partial<SeatPlayer> & { position: number },
): SeatPlayer {
  if (pending && pending.position === p.position) {
    return { ...p, ...pending }
  }
  return p
}

export function playersWhoCanAct(
  players: SeatPlayer[],
  pending?: Partial<SeatPlayer> & { position: number },
): SeatPlayer[] {
  return players.filter((p) => canPlayerAct(applyPendingUpdate(p, pending)))
}

export function isBettingRoundComplete(
  players: SeatPlayer[],
  currentBet: number,
  pending?: Partial<SeatPlayer> & { position: number },
): boolean {
  const stillInHand = players.filter((p) => !applyPendingUpdate(p, pending).has_folded)
  if (stillInHand.length <= 1) return true

  const active = playersWhoCanAct(players, pending)
  if (active.length === 0) return true

  return active.every((p) => {
    const u = applyPendingUpdate(p, pending)
    return (u.current_bet ?? 0) >= currentBet && u.has_acted === true
  })
}

export function findNextActingSeat(
  fromPos: number,
  players: SeatPlayer[],
  pending?: Partial<SeatPlayer> & { position: number },
): number {
  const seats = sortedSeatPositions(players)
  if (seats.length === 0) return -1
  let pos = fromPos
  for (let i = 0; i < seats.length; i++) {
    pos = nextSeat(pos, seats)
    const p = players.find((x) => x.position === pos)
    if (p && canPlayerAct(applyPendingUpdate(p, pending))) return pos
  }
  return -1
}

export interface BlindSetup {
  dealerPosition: number
  smallBlindPosition: number
  bigBlindPosition: number
  actionOn: number
  useSingleBlind: boolean
}

/** Compute blind seats from occupied positions (clockwise order). */
export function computeBlindSetup(seats: number[], playerCount: number): BlindSetup {
  const sorted = sortedSeatPositions(seats.map((s) => ({ position: s })))
  const useSingleBlind = playerCount <= 3
  const dealerPosition = sorted[0]!

  if (useSingleBlind) {
    const bb = sorted[0]!
    const actionOn = sorted[1] ?? sorted[0]!
    return {
      dealerPosition,
      smallBlindPosition: -1,
      bigBlindPosition: bb,
      actionOn,
      useSingleBlind: true,
    }
  }

  const sb = sorted[0]!
  const bb = sorted[1]!
  const actionOn = sorted[2] ?? sorted[0]!
  return {
    dealerPosition,
    smallBlindPosition: sb,
    bigBlindPosition: bb,
    actionOn,
    useSingleBlind: false,
  }
}

/** Rotate dealer one seat clockwise for the next hand. */
export function rotateDealer(currentDealer: number, seats: number[]): number {
  return nextSeat(currentDealer, seats)
}
