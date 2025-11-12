'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Player, BettingAction, Card } from '@/lib/poker'
import PokerPlayer from './PokerPlayer'
import PokerChips from './PokerChips'

interface GameStateData {
  room_pin: string
  hand_number: number
  betting_round: string
  current_bet: number
  dealer_position: number
  small_blind_position: number
  big_blind_position: number
  action_on: number
  small_blind: number
  big_blind: number
  pot_main: number
  pot_side_pots: Array<{ amount: number; eligiblePlayers: string[] }>
  community_cards: Card[]
  is_game_active: boolean
}

interface PokerTableProps {
  pin: string
  onBack: () => void
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-black',
  spades: 'text-black',
}

export default function PokerTable({ pin, onBack }: PokerTableProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [gameState, setGameState] = useState<GameStateData | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [betAmount, setBetAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const playerId = sessionStorage.getItem('poker_playerId')
      setCurrentPlayerId(playerId)
    }
  }, [])

  useEffect(() => {
    loadGameData()

    // Subscribe to player changes
    const playerSubscription = supabase
      .channel(`table-players:${pin}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_players',
          filter: `room_pin=eq.${pin}`,
        },
        () => {
          loadGameData()
        }
      )
      .subscribe()

    // Subscribe to game state changes
    const stateSubscription = supabase
      .channel(`table-state:${pin}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_game_state',
          filter: `room_pin=eq.${pin}`,
        },
        () => {
          loadGameData()
        }
      )
      .subscribe()

    return () => {
      playerSubscription.unsubscribe()
      stateSubscription.unsubscribe()
    }
  }, [pin])

  const loadGameData = async () => {
    try {
      const response = await fetch(`/api/poker/rooms/${pin}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load game')
      }

      // Convert database players to Player type
      // Use player_id as the id for matching with currentPlayerId
      const convertedPlayers: Player[] = (data.players || []).map((p: any) => ({
        id: p.player_id, // Use player_id for matching
        name: p.name,
        chips: p.chips,
        position: p.position,
        isActive: p.is_active,
        isAllIn: p.is_all_in,
        currentBet: p.current_bet,
        holeCards: p.hole_cards,
        hasFolded: p.has_folded,
        hasActed: p.has_acted,
      }))

      setPlayers(convertedPlayers)
      setGameState(data.gameState)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game')
      setLoading(false)
    }
  }

  const handleAction = async (action: BettingAction, amount?: number) => {
    if (!currentPlayerId || !gameState) return

    const currentPlayer = players.find(p => p.id === currentPlayerId)
    if (!currentPlayer) return

    try {
      // Update player action in database
      const actionData: any = {
        action,
        amount: amount || 0,
      }

      if (action === 'bet' || action === 'raise') {
        actionData.amount = betAmount || gameState.big_blind
      } else if (action === 'call') {
        actionData.amount = gameState.current_bet - currentPlayer.currentBet
      } else if (action === 'all-in') {
        actionData.amount = currentPlayer.chips
      }

      // Use API route for betting actions
      const response = await fetch('/api/poker/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          playerId: currentPlayerId,
          action,
          amount: actionData.amount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Action failed')
      }

      setBetAmount(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  const getPlayerPosition = (index: number, total: number) => {
    if (total === 0) return { top: '50%', left: '50%' }

    const angle = (index / total) * 2 * Math.PI - Math.PI / 2
    const radius = 180
    const centerX = 50
    const centerY = 50

    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)

    return {
      top: `${y}%`,
      left: `${x}%`,
    }
  }

  const renderCard = (card: Card | null, index: number) => {
    if (!card) {
      return (
        <div
          key={index}
          className="w-12 h-16 bg-gray-800 border-2 border-gray-600 rounded flex items-center justify-center"
        >
          <div className="text-gray-600 text-xs">?</div>
        </div>
      )
    }

    return (
      <div
        key={index}
        className={`w-12 h-16 bg-white border-2 border-gray-400 rounded flex flex-col items-center justify-center ${SUIT_COLORS[card.suit]}`}
      >
        <div className="text-sm font-bold">{card.rank}</div>
        <div className="text-lg">{SUIT_SYMBOLS[card.suit]}</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">
          <div className="text-red-400 mb-4">Game not found or not started</div>
          <button
            onClick={onBack}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const currentPlayer = players.find(p => p.id === currentPlayerId)
  const isMyTurn = currentPlayer && gameState.action_on === currentPlayer.position
  const minBet = gameState.big_blind
  const maxBet = currentPlayer ? currentPlayer.chips : 0
  const callAmount = currentPlayer ? Math.max(0, gameState.current_bet - currentPlayer.currentBet) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/20 text-white"
          >
            ← Back
          </button>
          <div className="text-white">
            <div className="text-sm text-gray-300">Hand #{gameState.hand_number}</div>
            <div className="text-lg font-semibold capitalize">{gameState.betting_round.replace('-', ' ')}</div>
          </div>
          <div className="text-white text-sm">Room: {pin}</div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Table Area */}
        <div className="relative bg-gradient-to-br from-green-800 to-green-900 rounded-full border-8 border-amber-800 shadow-2xl" style={{ aspectRatio: '1', minHeight: '500px' }}>
          {/* Community Cards */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-2">
            {Array.from({ length: 5 }).map((_, i) =>
              renderCard(gameState.community_cards[i] || null, i)
            )}
          </div>

          {/* Pot Display */}
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="bg-black/50 backdrop-blur-sm rounded-lg px-6 py-3 border-2 border-yellow-400">
              <div className="text-yellow-400 text-sm mb-1">Pot</div>
              <div className="text-white text-3xl font-bold">
                <PokerChips amount={gameState.pot_main} size="md" showLabel={true} />
              </div>
              {gameState.pot_side_pots && gameState.pot_side_pots.length > 0 && (
                <div className="text-yellow-300 text-xs mt-1">
                  + {gameState.pot_side_pots.length} side pot{gameState.pot_side_pots.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Players */}
          {players.map((player, index) => {
            const position = getPlayerPosition(index, players.length)
            return (
              <PokerPlayer
                key={player.id}
                player={player}
                isCurrentPlayer={player.id === currentPlayerId}
                isActionOn={gameState.action_on === player.position}
                isDealer={gameState.dealer_position === player.position}
                isSmallBlind={gameState.small_blind_position === player.position}
                isBigBlind={gameState.big_blind_position === player.position}
                position={position}
              />
            )
          })}
        </div>

        {/* Betting Controls */}
        {isMyTurn && currentPlayer && !currentPlayer.hasFolded && !currentPlayer.isAllIn && (
          <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="text-white text-center mb-4">
              <div className="text-xl font-semibold">Your Turn</div>
              <div className="text-sm text-gray-300">
                Chips: ${currentPlayer.chips} | Current Bet: ${gameState.current_bet} | To Call: ${callAmount}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center mb-4">
              <button
                onClick={() => handleAction('fold')}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Fold
              </button>

              {callAmount === 0 ? (
                <button
                  onClick={() => handleAction('check')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Check
                </button>
              ) : (
                <button
                  onClick={() => handleAction('call')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Call ${callAmount}
                </button>
              )}

              {callAmount > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={betAmount || minBet}
                      onChange={(e) => setBetAmount(Math.max(minBet, Math.min(maxBet, parseInt(e.target.value) || minBet)))}
                      className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-center"
                      min={minBet}
                      max={maxBet}
                    />
                    <button
                      onClick={() => handleAction('bet')}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
                    >
                      Bet ${betAmount || minBet}
                    </button>
                    <button
                      onClick={() => handleAction('raise')}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold"
                    >
                      Raise ${betAmount || minBet}
                    </button>
                  </div>
                </>
              )}

              <button
                onClick={() => handleAction('all-in')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                All-In ${currentPlayer.chips}
              </button>
            </div>
          </div>
        )}

        {!isMyTurn && currentPlayer && (
          <div className="mt-6 text-center text-gray-300">
            Waiting for other players...
          </div>
        )}
      </div>
    </div>
  )
}

