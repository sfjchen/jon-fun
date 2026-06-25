import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  validateRoomPin,
  BETTING_ROUNDS,
  type BettingAction,
  type SeatPlayer,
  isBettingRoundComplete,
  findNextActingSeat,
  firstSeatAfter,
  sortedSeatPositions,
  canPlayerAct,
  applyPendingUpdate,
} from '@/lib/poker'

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

    const [gameStateResult, playerResult, allPlayersResult] = await Promise.all([
      supabase.from('poker_game_state').select('*').eq('room_pin', pin).single(),
      supabase.from('poker_players').select('*').eq('room_pin', pin).eq('player_id', playerId).single(),
      supabase.from('poker_players').select('*').eq('room_pin', pin).eq('is_active', true).order('position', { ascending: true }),
    ])

    const gameState = gameStateResult.data
    const player = playerResult.data
    const allPlayersRaw = allPlayersResult.data || []

    if (gameStateResult.error || !gameState || !gameState.is_game_active) {
      return NextResponse.json({ error: 'Game not found or not active' }, { status: 404 })
    }

    if (playerResult.error || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    if (gameState.action_on !== player.position) {
      return NextResponse.json({ error: 'Not your turn' }, { status: 409 })
    }

    if (player.has_folded || player.is_all_in) {
      return NextResponse.json({ error: 'You cannot act' }, { status: 409 })
    }

    const chipsAvailable = Math.max(0, player.chips)
    const currentBet = gameState.current_bet ?? 0
    const bb = gameState.big_blind ?? 10
    const toCall = Math.max(0, currentBet - (player.current_bet ?? 0))

    let actionAmount = amount ?? 0
    if (action === 'call') {
      actionAmount = Math.min(toCall, chipsAvailable)
    } else if (action === 'check') {
      if (toCall > 0) {
        return NextResponse.json({ error: 'Cannot check — must call or fold' }, { status: 400 })
      }
      actionAmount = 0
    } else if (action === 'bet') {
      if (currentBet > 0) {
        return NextResponse.json({ error: 'Cannot bet — use raise' }, { status: 400 })
      }
      actionAmount = Math.max(bb, Math.min(chipsAvailable, amount ?? bb))
    } else if (action === 'raise') {
      if (currentBet === 0) {
        return NextResponse.json({ error: 'Cannot raise — use bet' }, { status: 400 })
      }
      const minRaiseTotal = currentBet + bb
      const targetTotal = Math.max(minRaiseTotal, (player.current_bet ?? 0) + (amount ?? bb))
      actionAmount = Math.min(chipsAvailable, targetTotal - (player.current_bet ?? 0))
      if ((player.current_bet ?? 0) + actionAmount < minRaiseTotal && actionAmount < chipsAvailable) {
        return NextResponse.json({ error: `Minimum raise is $${minRaiseTotal - (player.current_bet ?? 0)}` }, { status: 400 })
      }
    } else if (action === 'all-in') {
      actionAmount = chipsAvailable
    } else if (action === 'fold') {
      actionAmount = 0
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (actionAmount < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const newPlayerBet = action === 'fold' ? 0 : (player.current_bet ?? 0) + actionAmount
    const newPlayerChips = action === 'fold' ? player.chips : Math.max(0, player.chips - actionAmount)
    const newPlayerAllIn = action !== 'fold' && newPlayerChips === 0 && actionAmount > 0

    const pendingUpdate: Partial<SeatPlayer> & { position: number } = {
      position: player.position,
      has_acted: true,
      has_folded: action === 'fold',
      current_bet: newPlayerBet,
      is_all_in: newPlayerAllIn || player.is_all_in,
    }

    const newCurrentBet =
      action === 'bet' || action === 'raise' || action === 'all-in'
        ? Math.max(currentBet, newPlayerBet)
        : currentBet

    const raised = newCurrentBet > currentBet
    const newPotMain = (gameState.pot_main ?? 0) + actionAmount

    const seatPlayers: SeatPlayer[] = allPlayersRaw.map((p) => ({
      position: p.position,
      has_folded: p.has_folded,
      is_all_in: p.is_all_in,
      has_acted: p.has_acted,
      current_bet: p.current_bet,
      chips: p.chips,
    }))

    const notFolded = seatPlayers.filter((p) => {
      const u = applyPendingUpdate(p, pendingUpdate)
      return !u.has_folded
    })
    const handWonByFold = notFolded.length <= 1

    const roundComplete = handWonByFold || isBettingRoundComplete(seatPlayers, newCurrentBet, pendingUpdate)
    const roundIdx = BETTING_ROUNDS.indexOf((gameState.betting_round as (typeof BETTING_ROUNDS)[number]) ?? 'pre-flop')

    let nextActionOn = gameState.action_on
    let nextBettingRound = gameState.betting_round
    let nextCurrentBet = newCurrentBet
    let resetStreetBets = false

    if (roundComplete) {
      if (handWonByFold || roundIdx >= 3) {
        nextActionOn = -1
      } else {
        nextBettingRound = BETTING_ROUNDS[roundIdx + 1]!
        nextCurrentBet = 0
        resetStreetBets = true
        const dealerPos = gameState.dealer_position ?? 0
        const seats = sortedSeatPositions(seatPlayers)
        nextActionOn = firstSeatAfter(dealerPos, seats)
        const firstActor = seatPlayers.find((p) => p.position === nextActionOn)
        if (!firstActor || !canPlayerAct(firstActor)) {
          nextActionOn = findNextActingSeat(dealerPos, seatPlayers)
        }
      }
    } else {
      nextActionOn = findNextActingSeat(player.position, seatPlayers, pendingUpdate)
    }

    const now = new Date().toISOString()

    await supabase
      .from('poker_players')
      .update({
        has_acted: true,
        has_folded: action === 'fold',
        current_bet: newPlayerBet,
        chips: newPlayerChips,
        is_all_in: newPlayerAllIn,
      })
      .eq('room_pin', pin)
      .eq('player_id', playerId)

    if (raised && !roundComplete) {
      await supabase
        .from('poker_players')
        .update({ has_acted: false })
        .eq('room_pin', pin)
        .neq('player_id', playerId)
      await supabase
        .from('poker_players')
        .update({ has_acted: true })
        .eq('room_pin', pin)
        .eq('player_id', playerId)
    }

    if (resetStreetBets) {
      await supabase
        .from('poker_players')
        .update({ has_acted: false, current_bet: 0 })
        .eq('room_pin', pin)
    }

    await Promise.all([
      supabase.from('poker_actions').insert({
        room_pin: pin,
        hand_number: gameState.hand_number,
        player_id: playerId,
        action: action as BettingAction,
        amount: actionAmount,
        timestamp: now,
      }),
      supabase.from('poker_rooms').update({ last_activity: now }).eq('pin', pin),
      supabase
        .from('poker_game_state')
        .update({
          current_bet: nextCurrentBet,
          pot_main: newPotMain,
          action_on: nextActionOn,
          betting_round: nextBettingRound,
        })
        .eq('room_pin', pin),
    ])

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
