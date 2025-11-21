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

    // Get current game state
    const { data: gameState, error: stateError } = await supabase
      .from('poker_game_state')
      .select('*')
      .eq('room_pin', pin)
      .single()

    if (stateError || !gameState) {
      return NextResponse.json({ error: 'Game not found or not active' }, { status: 404 })
    }

    // Get player
    const { data: player, error: playerError } = await supabase
      .from('poker_players')
      .select('*')
      .eq('room_pin', pin)
      .eq('player_id', playerId)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Calculate action amount
    let actionAmount = amount || 0
    if (action === 'call') {
      actionAmount = Math.max(0, gameState.current_bet - player.current_bet)
    } else if (action === 'bet' || action === 'raise') {
      actionAmount = amount || gameState.big_blind
    } else if (action === 'all-in') {
      actionAmount = player.chips
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
      console.error('Error updating player:', updateError)
      return NextResponse.json({ error: 'Failed to update player' }, { status: 500 })
    }

    // Record action
    await supabase.from('poker_actions').insert({
      room_pin: pin,
      hand_number: gameState.hand_number,
      player_id: playerId,
      action: action as BettingAction,
      amount: actionAmount,
      timestamp: new Date().toISOString(),
    })

    // Update game state current bet if needed
    if (action === 'bet' || action === 'raise') {
      await supabase
        .from('poker_game_state')
        .update({ current_bet: actionAmount })
        .eq('room_pin', pin)
    }

    // Update room last_activity
    await supabase
      .from('poker_rooms')
      .update({ last_activity: new Date().toISOString() })
      .eq('pin', pin)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/poker/actions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

