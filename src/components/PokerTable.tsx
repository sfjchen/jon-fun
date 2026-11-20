'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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

interface DbPlayer {
  player_id: string
  name: string
  chips: number
  position: number
  is_active: boolean
  is_all_in: boolean
  current_bet: number
  hole_cards: Card[] | null
  has_folded: boolean
  has_acted: boolean
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
  const [room, setRoom] = useState<{ timer_per_turn?: number; host_id?: string } | null>(null)
  const currentPlayerId = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem('poker_playerId'),
    () => null,
  )
  const [betAmount, setBetAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isMobile = useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb)
      return () => window.removeEventListener('resize', cb)
    },
    () => window.innerWidth < 768,
    () => false,
  )
  const [timeRemaining, setTimeRemaining] = useState<Record<number, number>>({})
  const hostId = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem('poker_hostId'),
    () => null,
  )
  const [nextHandWinner, setNextHandWinner] = useState<string>('')
  const [startingNextHand, setStartingNextHand] = useState(false)
  const timerExpiredRef = useRef<number | null>(null)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchAbortRef = useRef<AbortController | null>(null)

  const loadGameData = useCallback(
    (signal?: AbortSignal) => {
      const init: RequestInit | undefined = signal ? { signal } : undefined
      return fetch(`/api/poker/rooms/${pin}`, init)
        .then(async (response) => {
          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || 'Failed to load game')
          }

          const convertedPlayers: Player[] = (data.players || [])
            .map((p: DbPlayer) => ({
              id: p.player_id,
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
            .sort((a: Player, b: Player) => a.position - b.position)

          setPlayers(convertedPlayers)
          setGameState(data.gameState)
          setRoom(data.room)
          setLoading(false)
        })
        .catch((err) => {
          if (signal?.aborted) return
          setError(err instanceof Error ? err.message : 'Failed to load game')
          setLoading(false)
        })
    },
    [pin],
  )

  const scheduleLoad = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchAbortRef.current?.abort()
      const controller = new AbortController()
      fetchAbortRef.current = controller
      void loadGameData(controller.signal)
    }, 120)
  }, [loadGameData])

  useEffect(() => {
    loadGameData()

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
        scheduleLoad,
      )
      .subscribe()

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
        scheduleLoad,
      )
      .subscribe()

    return () => {
      playerSubscription.unsubscribe()
      stateSubscription.unsubscribe()
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      fetchAbortRef.current?.abort()
    }
  }, [pin, loadGameData, scheduleLoad])

  // Resets the acting seat's timer when the turn or timer length changes
  const turnKey = `${gameState?.action_on}:${room?.timer_per_turn}`
  const [prevTurnKey, setPrevTurnKey] = useState(turnKey)
  if (turnKey !== prevTurnKey) {
    setPrevTurnKey(turnKey)
    if (gameState && room?.timer_per_turn && gameState.action_on >= 0) {
      const timerPerTurn = room.timer_per_turn
      setTimeRemaining((prev) => ({ ...prev, [gameState.action_on]: timerPerTurn }))
    }
  }

  // Timer countdown effect
  useEffect(() => {
    if (!gameState || !room?.timer_per_turn || gameState.action_on < 0) return

    const timerPerTurn = room.timer_per_turn
    const actionOnPosition = gameState.action_on

    const intervalId = setInterval(() => {
      setTimeRemaining((prev) => {
        const current = prev[actionOnPosition] ?? timerPerTurn
        if (current <= 0) {
          return prev
        }
        return {
          ...prev,
          [actionOnPosition]: current - 1,
        }
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [gameState?.action_on, room?.timer_per_turn])

  const handleAction = async (action: BettingAction, amount?: number) => {
    if (!currentPlayerId || !gameState) return

    const currentPlayer = players.find((p) => p.id === currentPlayerId)
    if (!currentPlayer) return

    try {
      // Update player action in database
      const actionData: {
        action: BettingAction
        amount: number
      } = {
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
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  // Auto check/fold when turn timer expires (client-side nudge for home games)
  useEffect(() => {
    if (!gameState || gameState.action_on < 0 || !currentPlayerId) return
    const currentPlayer = players.find((p) => p.id === currentPlayerId)
    if (!currentPlayer || gameState.action_on !== currentPlayer.position) return

    const remaining = timeRemaining[gameState.action_on]
    if (remaining !== 0) {
      timerExpiredRef.current = null
      return
    }
    if (timerExpiredRef.current === gameState.action_on) return
    timerExpiredRef.current = gameState.action_on

    const callAmt = Math.max(0, gameState.current_bet - currentPlayer.currentBet)
    void handleAction(callAmt === 0 ? 'check' : 'fold')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, gameState?.action_on, currentPlayerId, players])

  const handleNextHand = async () => {
    if (!hostId || !nextHandWinner) return
    setStartingNextHand(true)
    setError('')
    try {
      const response = await fetch(`/api/poker/rooms/${pin}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'next_hand',
          hostId,
          winnerId: nextHandWinner,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to start next hand')
      setNextHandWinner('')
      timerExpiredRef.current = null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start next hand')
    } finally {
      setStartingNextHand(false)
    }
  }

  const getPlayerPosition = (index: number, total: number) => {
    if (total === 0) return { top: '50%', left: '50%' }

    const angle = (index / total) * 2 * Math.PI - Math.PI / 2
    // Responsive radius: smaller on mobile, larger on desktop
    const radius = isMobile ? 120 : 180
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
          className="flex h-14 w-10 items-center justify-center rounded border-2 border-gray-600 bg-gray-800 sm:h-16 sm:w-12"
        >
          <div className="text-xs text-gray-600">?</div>
        </div>
      )
    }

    return (
      <div
        key={index}
        className={`flex h-14 w-10 flex-col items-center justify-center rounded border-2 border-gray-400 bg-white sm:h-16 sm:w-12 ${SUIT_COLORS[card.suit]}`}
      >
        <div className="text-xs font-bold sm:text-sm">{card.rank}</div>
        <div className="text-sm sm:text-lg">{SUIT_SYMBOLS[card.suit]}</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900">
        <div className="text-xl text-white">Loading game...</div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-8 text-center backdrop-blur-sm">
          <div className="mb-4 text-red-400">Game not found or not started</div>
          <button onClick={onBack} className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const currentPlayer = players.find((p) => p.id === currentPlayerId)
  const isMyTurn = currentPlayer && gameState.action_on === currentPlayer.position
  const minBet = gameState.big_blind
  const maxBet = currentPlayer ? currentPlayer.chips : 0
  const callAmount = currentPlayer ? Math.max(0, gameState.current_bet - currentPlayer.currentBet) : 0
  const canOpenBet = gameState.current_bet === 0
  const isHost = hostId && room?.host_id === hostId
  const actingPlayer = players.find((p) => p.position === gameState.action_on)
  const activePlayers = players.filter((p) => !p.hasFolded)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 p-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 sm:px-4 sm:text-base"
          >
            ← Back
          </button>
          <div className="text-center text-white">
            <div className="text-xs text-gray-300 sm:text-sm">Hand #{gameState.hand_number}</div>
            <div className="text-sm font-semibold capitalize sm:text-lg">
              {gameState.betting_round.replace('-', ' ')}
            </div>
          </div>
          <div className="text-xs text-white sm:text-sm">Room: {pin}</div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/20 p-3 text-red-200">{error}</div>
        )}

        {/* Table Area */}
        <div
          className="relative mx-auto rounded-full border-4 border-amber-800 bg-gradient-to-br from-green-800 to-green-900 shadow-2xl sm:border-8"
          style={{ aspectRatio: '1', width: '100%', maxWidth: '600px', minHeight: '300px' }}
        >
          {/* Community Cards */}
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 transform gap-2">
            {Array.from({ length: 5 }).map((_, i) => renderCard(gameState.community_cards[i] || null, i))}
          </div>

          {/* Pot Display */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 transform text-center">
            <div className="rounded-lg border-2 border-yellow-400 bg-black/50 px-3 py-2 backdrop-blur-sm sm:px-6 sm:py-3">
              <div className="mb-1 text-xs text-yellow-400 sm:text-sm">Pot</div>
              <div className="text-xl font-bold text-white sm:text-3xl">
                <PokerChips amount={gameState.pot_main} size="sm" showLabel={true} />
              </div>
              {gameState.pot_side_pots && gameState.pot_side_pots.length > 0 && (
                <div className="mt-1 text-xs text-yellow-300">
                  + {gameState.pot_side_pots.length} side pot{gameState.pot_side_pots.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Players - Show all 12 seats */}
          {Array.from({ length: 12 }).map((_, seatIndex) => {
            const player = players.find((p) => p.position === seatIndex)
            const position = getPlayerPosition(seatIndex, 12)
            const timerPerTurn = room?.timer_per_turn || 40
            const remaining = timeRemaining[seatIndex] ?? (gameState.action_on === seatIndex ? timerPerTurn : undefined)

            return (
              <PokerPlayer
                key={seatIndex}
                player={player || null}
                isCurrentPlayer={player?.id === currentPlayerId}
                isActionOn={gameState.action_on === seatIndex}
                isDealer={gameState.dealer_position === seatIndex}
                isSmallBlind={gameState.small_blind_position === seatIndex && gameState.small_blind_position >= 0}
                isBigBlind={gameState.big_blind_position === seatIndex}
                position={position}
                {...(remaining !== undefined && { timeRemaining: remaining })}
                totalTime={timerPerTurn}
              />
            )
          })}
        </div>

        {/* Betting Controls */}
        {isMyTurn && currentPlayer && !currentPlayer.hasFolded && !currentPlayer.isAllIn && (
          <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm sm:mt-6 sm:p-6">
            <div className="mb-4 text-center text-white">
              <div className="text-lg font-semibold sm:text-xl">Your Turn</div>
              <div className="text-xs text-gray-300 sm:text-sm">
                Chips: ${currentPlayer.chips} | Current Bet: ${gameState.current_bet} | To Call: ${callAmount}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap justify-center gap-2 sm:gap-3">
              <button
                data-hotkey="f"
                onClick={() => handleAction('fold')}
                className="min-h-11 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 sm:px-6 sm:text-base"
              >
                Fold
              </button>

              {callAmount === 0 ? (
                <button
                  data-hotkey="c Space"
                  onClick={() => handleAction('check')}
                  className="min-h-11 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:px-6 sm:text-base"
                >
                  Check
                </button>
              ) : (
                <button
                  data-hotkey="c"
                  onClick={() => handleAction('call')}
                  className="min-h-11 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:px-6 sm:text-base"
                >
                  Call ${callAmount}
                </button>
              )}

              <div className="flex w-full items-center justify-center gap-2 sm:w-auto">
                <input
                  type="number"
                  value={betAmount || minBet}
                  onChange={(e) => setBetAmount(Math.max(minBet, Math.min(maxBet, parseInt(e.target.value) || minBet)))}
                  className="min-h-11 w-20 rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-center text-sm text-white sm:w-24 sm:px-3 sm:text-base"
                  min={minBet}
                  max={maxBet}
                />
                {[1, -1].map((d) => (
                  <button
                    key={d}
                    tabIndex={-1}
                    className="sr-only"
                    data-hotkey={d > 0 ? 'ArrowUp' : 'ArrowDown'}
                    aria-label={d > 0 ? 'Raise the bet amount' : 'Lower the bet amount'}
                    onClick={() => setBetAmount(Math.max(minBet, Math.min(maxBet, (betAmount || minBet) + d * minBet)))}
                  />
                ))}
                {canOpenBet ? (
                  <button
                    data-hotkey="b"
                    onClick={() => handleAction('bet')}
                    className="min-h-11 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 sm:px-6 sm:text-base"
                  >
                    Bet ${betAmount || minBet}
                  </button>
                ) : (
                  <button
                    data-hotkey="r"
                    onClick={() => handleAction('raise')}
                    className="min-h-11 rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 sm:px-6 sm:text-base"
                  >
                    Raise ${betAmount || minBet}
                  </button>
                )}
              </div>

              <button
                onClick={() => handleAction('all-in')}
                className="min-h-11 rounded-lg bg-yellow-600 px-4 py-3 text-sm font-semibold text-white hover:bg-yellow-700 sm:px-6 sm:text-base"
              >
                All-In ${currentPlayer.chips}
              </button>
            </div>
          </div>
        )}

        {!isMyTurn && currentPlayer && gameState.action_on >= 0 && (
          <div className="mt-6 text-center text-gray-300">
            {actingPlayer ? (
              <span>
                Waiting for <span className="font-semibold text-yellow-300">{actingPlayer.name}</span>...
              </span>
            ) : (
              'Waiting for other players...'
            )}
          </div>
        )}

        {gameState.action_on === -1 && (
          <div className="mt-6 rounded-2xl border border-white/20 bg-white/10 p-4 text-center backdrop-blur-sm sm:p-6">
            <div className="mb-2 text-lg font-semibold text-yellow-300">Hand complete</div>
            <p className="mb-4 text-sm text-gray-300">
              Pot: ${gameState.pot_main.toLocaleString()} — award at the table, then start next hand
            </p>
            {isHost ? (
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <select
                  value={nextHandWinner}
                  onChange={(e) => setNextHandWinner(e.target.value)}
                  className="min-h-11 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white"
                >
                  <option value="" className="text-black">
                    Select winner...
                  </option>
                  {activePlayers.map((p) => (
                    <option key={p.id} value={p.id} className="text-black">
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  data-hotkey="n Enter"
                  onClick={handleNextHand}
                  disabled={!nextHandWinner || startingNextHand}
                  className="min-h-11 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:bg-gray-600"
                >
                  {startingNextHand ? 'Starting...' : 'Award Pot & Next Hand'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Waiting for host to award pot and start next hand...</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
