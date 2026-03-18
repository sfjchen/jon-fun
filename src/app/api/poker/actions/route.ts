import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateRoomPin } from '@/lib/poker'
import type { BettingAction } from '@/lib/poker'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pin, playerId, action, amount } = body

    if (!validateRoomPin(pin)) {
      return NextResponse.json({ error: 'Invalid room PIN' }, { status: 400 })
    }

    if (!playerId || !action) {
      return NextResponse.json({ error: 'Player ID and action are required' }, { status: 400 })
    }

    const [gameStateResult, playerResult] = await Promise.all([
      supabase
        .from('poker_game_state')
        .select('*')
        .eq('room_pin', pin)
        .single(),
      supabase
        .from('poker_players')
        .select('*')
        .eq('room_pin', pin)
        .eq('player_id', playerId)
        .single(),
    ])

    const gameState = gameStateResult.data
    const player = playerResult.data

    if (gameStateResult.error || !gameState || !gameState.is_game_active) {
      return NextResponse.json({ error: 'Game not found or not active' }, { status: 404 })
    }

    if (playerResult.error || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    if (gameState.action_on !== player.position) {
      return NextResponse.json({ error: 'Not your turn' }, { status: 409 })
    }

    // Calculate action amount
    const chipsAvailable = Math.max(0, player.chips)
    let actionAmount = amount ?? 0
    if (action === 'call') {
      actionAmount = Math.min(Math.max(0, gameState.current_bet - player.current_bet), chipsAvailable)
    } else if (action === 'bet' || action === 'raise') {
      const minBet = gameState.big_blind ?? 0
      actionAmount = Math.max(minBet, Math.min(chipsAvailable, amount ?? minBet))
    } else if (action === 'all-in') {
      actionAmount = chipsAvailable
    } else if (action === 'check' || action === 'fold') {
      actionAmount = 0
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (actionAmount < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Update player
    const updates: {
      has_acted: boolean
      has_folded?: boolean
      current_bet?: number
      chips?: number
      is_all_in?: boolean
    } = {
      has_acted: true,
    }

    if (action === 'fold') {
      updates.has_folded = true
      updates.current_bet = 0
    } else {
      updates.current_bet = player.current_bet + actionAmount
      updates.chips = Math.max(0, player.chips - actionAmount)
      if (updates.chips === 0) {
        updates.is_all_in = true
      }
    }

    const { error: updateError } = await supabase
      .from('poker_players')
      .update(updates)
      .eq('room_pin', pin)
      .eq('player_id', playerId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update player' }, { status: 500 })
    }

    const now = new Date().toISOString()
    const newCurrentBet =
      action === 'bet' || action === 'raise'
        ? Math.max(gameState.current_bet ?? 0, (player.current_bet ?? 0) + actionAmount)
        : gameState.current_bet

    // Add bet to pot for any action that puts chips in
    const addToPot = actionAmount
    const newPotMain = (gameState.pot_main ?? 0) + addToPot

    // Fetch all players to compute next action_on
    const { data: allPlayers } = await supabase
      .from('poker_players')
      .select('position, has_folded, is_all_in, has_acted')
      .eq('room_pin', pin)
      .order('position', { ascending: true })

    const players = allPlayers || []
    const canAct = (p: { has_folded?: boolean; is_all_in?: boolean }) =>
      !p.has_folded && !p.is_all_in

    // After this action, get updated has_acted for current player
    const updatedPlayerActed = true
    const updatedPlayerFolded = action === 'fold'
    const updatedPlayerAllIn = action !== 'fold' && player.chips - actionAmount <= 0

    const stillCanAct = (p: { position: number; has_folded?: boolean; is_all_in?: boolean; has_acted?: boolean }) => {
      if (p.position === player.position) {
        return !updatedPlayerFolded && !updatedPlayerAllIn
      }
      return canAct(p)
    }

    const hasActedAfter = (p: { position: number; has_acted?: boolean }) => {
      if (p.position === player.position) return updatedPlayerActed
      return p.has_acted ?? false
    }

    const ROUNDS = ['pre-flop', 'flop', 'turn', 'river'] as const
    const roundIdx = ROUNDS.indexOf((gameState.betting_round as (typeof ROUNDS)[number]) ?? 'pre-flop')
    const nextRound =
      roundIdx >= 0 && roundIdx < 3 ? ROUNDS[roundIdx + 1]! : gameState.betting_round

    const remainingCanAct = players.filter(stillCanAct)
    const allActed = remainingCanAct.every((p) => hasActedAfter(p))
    const onlyOneLeft = remainingCanAct.length <= 1

    let nextActionOn = gameState.action_on
    let nextBettingRound = gameState.betting_round
    let nextCurrentBet = newCurrentBet
    const nextPotMain = newPotMain
    let resetHasActed = false

    if (allActed || onlyOneLeft) {
      // Advance to next betting round (or hand complete)
      nextBettingRound = nextRound
      nextCurrentBet = 0
      resetHasActed = true
      if (roundIdx < 3) {
        // First to act post-flop: left of dealer (use stillCanAct to account for current player's action)
        const dealerPos = gameState.dealer_position ?? 0
        for (let i = 1; i <= 12; i++) {
          const pos = (dealerPos + i) % 12
          const p = players.find((x) => x.position === pos)
          if (p && stillCanAct(p)) {
            nextActionOn = pos
            break
          }
        }
      } else {
        // River complete, hand over
        nextActionOn = -1
      }
    } else {
      // Advance to next player
      for (let i = 1; i <= 12; i++) {
        const pos = (gameState.action_on + i) % 12
        const p = players.find((x) => x.position === pos)
        if (p && stillCanAct({ ...p, has_acted: p.position === player.position ? updatedPlayerActed : p.has_acted })) {
          nextActionOn = pos
          break
        }
      }
    }

    const stateUpdate: Record<string, unknown> = {
      current_bet: nextCurrentBet,
      pot_main: nextPotMain,
      action_on: nextActionOn,
      betting_round: nextBettingRound,
    }

    const dbUpdates = [
      supabase.from('poker_actions').insert({
        room_pin: pin,
        hand_number: gameState.hand_number,
        player_id: playerId,
        action: action as BettingAction,
        amount: actionAmount,
        timestamp: now,
      }),
      supabase
        .from('poker_rooms')
        .update({ last_activity: now })
        .eq('pin', pin),
      supabase
        .from('poker_game_state')
        .update(stateUpdate)
        .eq('room_pin', pin),
    ]

    if (resetHasActed) {
      dbUpdates.push(
        supabase
          .from('poker_players')
          .update({ has_acted: false })
          .eq('room_pin', pin)
      )
    }

    await Promise.all(dbUpdates)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

