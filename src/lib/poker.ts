// Texas Hold'em Poker Game Logic

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  suit: Suit
  rank: Rank
}

export type BettingAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in'

export interface PlayerAction {
  playerId: string
  action: BettingAction
  amount?: number
  timestamp: number
}

export type BettingRound = 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown' | 'finished'

export interface Player {
  id: string
  name: string
  chips: number
  position: number
  isActive: boolean
  isAllIn: boolean
  currentBet: number
  holeCards?: [Card, Card]
  hasFolded: boolean
  hasActed: boolean
}

export interface Pot {
  main: number
  sidePots: Array<{ amount: number; eligiblePlayers: string[] }>
}

export interface GameState {
  roomPin: string
  handNumber: number
  bettingRound: BettingRound
  players: Player[]
  communityCards: Card[]
  pot: Pot
  currentBet: number
  dealerPosition: number
  smallBlindPosition: number
  bigBlindPosition: number
  actionOn: number // index of player whose turn it is
  smallBlind: number
  bigBlind: number
  actions: PlayerAction[]
  isGameActive: boolean
}

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank })
    }
  }
  return shuffleDeck(deck)
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]!
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp
  }
  return shuffled
}

export function dealCards(deck: Card[], count: number): { cards: Card[]; remaining: Card[] } {
  const cards = deck.slice(0, count)
  const remaining = deck.slice(count)
  return { cards, remaining }
}

export function calculateHandStrength(cards: Card[]): {
  rank: number
  name: string
  highCards: Rank[]
} {
  if (cards.length < 5) {
    return { rank: 0, name: 'Incomplete', highCards: [] }
  }

  // Get all possible 5-card combinations
  const combinations = getCombinations(cards, 5)
  let bestHand = { rank: 0, name: 'High Card', highCards: [] as Rank[] }

  for (const combo of combinations) {
    const hand = evaluateHand(combo)
    if (hand.rank > bestHand.rank || (hand.rank === bestHand.rank && compareHighCards(hand.highCards, bestHand.highCards) > 0)) {
      bestHand = hand
    }
  }

  return bestHand
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  if (k === arr.length) return [arr]

  const result: T[][] = []
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i]!
    const tailCombos = getCombinations(arr.slice(i + 1), k - 1)
    for (const combo of tailCombos) {
      result.push([head, ...combo])
    }
  }
  return result
}

function evaluateHand(cards: Card[]): { rank: number; name: string; highCards: Rank[] } {
  const rankCounts = new Map<Rank, number>()
  const suitCounts = new Map<Suit, number>()

  for (const card of cards) {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1)
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1)
  }

  const rankArray = Array.from(rankCounts.entries()).sort((a, b) => {
    const rankA = RANKS.indexOf(a[0])
    const rankB = RANKS.indexOf(b[0])
    if (b[1] !== a[1]) return b[1] - a[1] // Sort by count first
    return rankB - rankA // Then by rank
  })

  const isFlush = suitCounts.size === 1
  const isStraight = isStraightCheck(rankCounts)
  const isStraightFlush = isFlush && isStraight

  // Royal Flush
  if (isStraightFlush && rankCounts.has('A') && rankCounts.has('K')) {
    return { rank: 9, name: 'Royal Flush', highCards: ['A'] }
  }

  // Straight Flush
  if (isStraightFlush) {
    const highCard = getStraightHighCard(rankCounts)
    return { rank: 8, name: 'Straight Flush', highCards: [highCard] }
  }

  // Four of a Kind
  if (rankArray[0] && rankArray[0][1] === 4) {
    return { rank: 7, name: 'Four of a Kind', highCards: [rankArray[0][0], rankArray[1]?.[0] || rankArray[0][0]] }
  }

  // Full House
  if (rankArray[0] && rankArray[1] && rankArray[0][1] === 3 && rankArray[1][1] === 2) {
    return { rank: 6, name: 'Full House', highCards: [rankArray[0][0], rankArray[1][0]] }
  }

  // Flush
  if (isFlush) {
    const highCards = cards.map(c => c.rank).sort((a, b) => RANKS.indexOf(b) - RANKS.indexOf(a)).slice(0, 5)
    return { rank: 5, name: 'Flush', highCards }
  }

  // Straight
  if (isStraight) {
    const highCard = getStraightHighCard(rankCounts)
    return { rank: 4, name: 'Straight', highCards: [highCard] }
  }

  // Three of a Kind
  if (rankArray[0] && rankArray[0][1] === 3) {
    const kickers = rankArray.slice(1).map(r => r[0]).slice(0, 2)
    return { rank: 3, name: 'Three of a Kind', highCards: [rankArray[0][0], ...kickers] }
  }

  // Two Pair
  if (rankArray[0] && rankArray[1] && rankArray[0][1] === 2 && rankArray[1][1] === 2) {
    const kicker = rankArray[2] ? rankArray[2][0] : rankArray[0][0]
    return { rank: 2, name: 'Two Pair', highCards: [rankArray[0][0], rankArray[1][0], kicker] }
  }

  // One Pair
  if (rankArray[0] && rankArray[0][1] === 2) {
    const kickers = rankArray.slice(1).map(r => r[0]).slice(0, 3)
    return { rank: 1, name: 'One Pair', highCards: [rankArray[0][0], ...kickers] }
  }

  // High Card
  const highCards = cards.map(c => c.rank).sort((a, b) => RANKS.indexOf(b) - RANKS.indexOf(a)).slice(0, 5)
  return { rank: 0, name: 'High Card', highCards }
}

function isStraightCheck(rankCounts: Map<Rank, number>): boolean {
  const ranks = Array.from(rankCounts.keys()).map(r => RANKS.indexOf(r)).sort((a, b) => a - b)
  
  // Check for regular straight
  for (let i = 0; i <= ranks.length - 5; i++) {
    let consecutive = 1
    for (let j = i + 1; j < ranks.length; j++) {
      const prevRank = ranks[j - 1]
      if (prevRank !== undefined && ranks[j] === prevRank + 1) {
        consecutive++
        if (consecutive === 5) return true
      } else {
        break
      }
    }
  }

  // Check for A-2-3-4-5 straight (wheel)
  const hasAce = rankCounts.has('A')
  const hasTwo = rankCounts.has('2')
  const hasThree = rankCounts.has('3')
  const hasFour = rankCounts.has('4')
  const hasFive = rankCounts.has('5')
  
  return hasAce && hasTwo && hasThree && hasFour && hasFive
}

function getStraightHighCard(rankCounts: Map<Rank, number>): Rank {
  const ranks = Array.from(rankCounts.keys()).map(r => RANKS.indexOf(r)).sort((a, b) => a - b)
  
  // Check for wheel (A-2-3-4-5)
  if (rankCounts.has('A') && rankCounts.has('2') && rankCounts.has('3') && rankCounts.has('4') && rankCounts.has('5')) {
    return '5'
  }

  // Find highest card in straight
  for (let i = ranks.length - 1; i >= 4; i--) {
    let consecutive = 1
    for (let j = i - 1; j >= 0; j--) {
      const nextRank = ranks[j + 1]
      if (nextRank !== undefined && ranks[j] === nextRank - 1) {
        consecutive++
        if (consecutive === 5) {
          return RANKS[ranks[i]!]!
        }
      } else {
        break
      }
    }
  }

  return 'A' // Fallback
}

function compareHighCards(a: Rank[], b: Rank[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const rankAValue = a[i]
    const rankBValue = b[i]
    const rankA = rankAValue ? RANKS.indexOf(rankAValue) : -1
    const rankB = rankBValue ? RANKS.indexOf(rankBValue) : -1
    if (rankA !== rankB) {
      return rankA - rankB
    }
  }
  return 0
}

export function calculatePots(players: Player[]): Pot {
  const activePlayers = players.filter(p => !p.hasFolded && p.isActive)
  const allInPlayers = activePlayers.filter(p => p.isAllIn)
  
  if (allInPlayers.length === 0) {
    // Simple pot - all bets go to main pot
    const mainPot = activePlayers.reduce((sum, p) => sum + p.currentBet, 0)
    return { main: mainPot, sidePots: [] }
  }

  // Complex pot calculation with side pots
  const bets = activePlayers.map(p => ({ playerId: p.id, amount: p.currentBet })).sort((a, b) => a.amount - b.amount)
  const pots: Array<{ amount: number; eligiblePlayers: string[] }> = []
  
  let previousLevel = 0
  for (let i = 0; i < bets.length; i++) {
    const currentLevel = bets[i].amount
    if (currentLevel > previousLevel) {
      const eligiblePlayers = bets.slice(i).map(b => b.playerId)
      const potAmount = (currentLevel - previousLevel) * eligiblePlayers.length
      pots.push({ amount: potAmount, eligiblePlayers })
      previousLevel = currentLevel
    }
  }

  const mainPot = pots[0] || { amount: 0, eligiblePlayers: [] }
  const sidePots = pots.slice(1)

  return {
    main: mainPot.amount,
    sidePots: sidePots.map(p => ({ amount: p.amount, eligiblePlayers: p.eligiblePlayers }))
  }
}

export function getNextPlayerPosition(currentPosition: number, players: Player[]): number {
  const activePlayers = players.filter(p => p.isActive && !p.hasFolded && !p.isAllIn)
  if (activePlayers.length <= 1) return currentPosition

  const positions = activePlayers.map(p => p.position).sort((a, b) => a - b)
  const currentIndex = positions.indexOf(currentPosition)
  const nextIndex = (currentIndex + 1) % positions.length
  return positions[nextIndex]
}

export function generateRoomPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export function validateRoomPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

