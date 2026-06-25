import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  validateRoomPin,
  computeBlindSetup,
  rotateDealer,
  sortedSeatPositions,
} from '@/lib/poker'
import { v4 as uuidv4 } from 'uuid'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    const { pin } = await params

    if (!validateRoomPin(pin)) {
      return NextResponse.json({ error: 'Invalid room PIN' }, { status: 400 })
    }

    // Get room
    const { data: room, error: roomError } = await supabase
      .from('poker_rooms')
      .select('*')
      .eq('pin', pin)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get players - sorted by position for clockwise order
    const { data: players, error: playersError } = await supabase
      .from('poker_players')
      .select('*')
      .eq('room_pin', pin)
      .order('position', { ascending: true })

    if (playersError) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
    }

    // Get game state if game is active
    let gameState = null
    if (room.status === 'active') {
      const { data: state } = await supabase
        .from('poker_game_state')
        .select('*')
        .eq('room_pin', pin)
        .single()
      gameState = state
    }

    return NextResponse.json({
      room,
      players: players || [],
      gameState,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    const { pin } = await params
    const body = await request.json()
    const { action, playerName, position, ...actionData } = body

    if (!validateRoomPin(pin)) {
      return NextResponse.json({ error: 'Invalid room PIN' }, { status: 400 })
    }

    // Check if room exists
    const { data: room, error: roomError } = await supabase
      .from('poker_rooms')
      .select('*')
      .eq('pin', pin)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    switch (action) {
      case 'join': {
        if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
          return NextResponse.json({ error: 'Player name is required' }, { status: 400 })
        }

        // Get all active players
        const { data: existingPlayers } = await supabase
          .from('poker_players')
          .select('position')
          .eq('room_pin', pin)
          .eq('is_active', true)

        const occupiedPositions = new Set((existingPlayers || []).map(p => p.position))
        const maxPlayers = 12

        if (occupiedPositions.size >= maxPlayers) {
          return NextResponse.json({ error: 'Room is full (max 12 players)' }, { status: 400 })
        }

        // If position is provided, validate it
        let selectedPosition: number
        if (position !== undefined && position !== null) {
          const pos = parseInt(position)
          if (isNaN(pos) || pos < 0 || pos >= maxPlayers) {
            return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
          }
          if (occupiedPositions.has(pos)) {
            return NextResponse.json({ error: 'Position already taken' }, { status: 400 })
          }
          selectedPosition = pos
        } else {
          // Find first available position (0-11)
          selectedPosition = 0
          for (let i = 0; i < maxPlayers; i++) {
            if (!occupiedPositions.has(i)) {
              selectedPosition = i
              break
            }
          }
        }

        const newPlayerId = uuidv4()
        const playerId = uuidv4()
        const { error: joinError } = await supabase
          .from('poker_players')
          .insert({
            id: playerId,
            room_pin: pin,
            player_id: newPlayerId,
            name: playerName.trim(),
            chips: 0,
            position: selectedPosition,
            is_active: true,
            is_all_in: false,
            current_bet: 0,
            has_folded: false,
            has_acted: false,
          })

        if (joinError) {
          return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
        }

        // Update room last_activity timestamp
        await supabase
          .from('poker_rooms')
          .update({ last_activity: new Date().toISOString() })
          .eq('pin', pin)

        return NextResponse.json({ playerId: newPlayerId, position: selectedPosition })
      }

      case 'start': {
        if (actionData.hostId !== room.host_id) {
          return NextResponse.json({ error: 'Only host can start the game' }, { status: 403 })
        }

        const { data: players } = await supabase
          .from('poker_players')
          .select('*')
          .eq('room_pin', pin)
          .eq('is_active', true)
          .order('position', { ascending: true })

        if (!players || players.length < 2) {
          return NextResponse.json({ error: 'Need at least 2 players to start' }, { status: 400 })
        }

        const { error: updateError } = await supabase
          .from('poker_rooms')
          .update({ status: 'active', last_activity: new Date().toISOString() })
          .eq('pin', pin)

        if (updateError) {
          return NextResponse.json({ error: 'Failed to start game' }, { status: 500 })
        }

        const seats = sortedSeatPositions(players)
        const blinds = computeBlindSetup(seats, players.length)
        const sb = blinds.useSingleBlind ? 0 : room.small_blind
        const bb = room.big_blind
        const startingChips = 100 * bb

        for (const p of players) {
          let chips = startingChips
          let currentBet = 0
          if (p.position === blinds.smallBlindPosition && p.position === blinds.bigBlindPosition) {
            chips = startingChips - sb - bb
            currentBet = sb + bb
          } else if (p.position === blinds.smallBlindPosition) {
            chips = startingChips - sb
            currentBet = sb
          } else if (p.position === blinds.bigBlindPosition) {
            chips = startingChips - bb
            currentBet = bb
          }
          await supabase
            .from('poker_players')
            .update({
              chips,
              current_bet: currentBet,
              has_folded: false,
              has_acted: false,
              is_all_in: false,
            })
            .eq('room_pin', pin)
            .eq('player_id', p.player_id)
        }

        const potMain = sb + bb

        const { error: stateError } = await supabase
          .from('poker_game_state')
          .insert({
            room_pin: pin,
            hand_number: 1,
            betting_round: 'pre-flop',
            current_bet: bb,
            dealer_position: blinds.dealerPosition,
            small_blind_position: blinds.smallBlindPosition,
            big_blind_position: blinds.bigBlindPosition,
            action_on: blinds.actionOn,
            small_blind: sb,
            big_blind: bb,
            pot_main: potMain,
            pot_side_pots: [],
            community_cards: [],
            is_game_active: true,
          })

        if (stateError) {
          return NextResponse.json({ error: 'Failed to initialize game state' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
      }

      case 'next_hand': {
        if (actionData.hostId !== room.host_id) {
          return NextResponse.json({ error: 'Only host can start next hand' }, { status: 403 })
        }

        const { winnerId } = actionData as { winnerId?: string }
        if (!winnerId) {
          return NextResponse.json({ error: 'Winner player ID is required' }, { status: 400 })
        }

        const { data: gameState } = await supabase
          .from('poker_game_state')
          .select('*')
          .eq('room_pin', pin)
          .single()

        if (!gameState || gameState.action_on !== -1) {
          return NextResponse.json({ error: 'Current hand is not complete' }, { status: 400 })
        }

        const { data: players } = await supabase
          .from('poker_players')
          .select('*')
          .eq('room_pin', pin)
          .eq('is_active', true)
          .order('position', { ascending: true })

        if (!players || players.length < 2) {
          return NextResponse.json({ error: 'Need at least 2 players' }, { status: 400 })
        }

        const winner = players.find((p) => p.player_id === winnerId)
        if (!winner) {
          return NextResponse.json({ error: 'Winner not found' }, { status: 404 })
        }

        const potAmount = gameState.pot_main ?? 0
        const seats = sortedSeatPositions(players)
        const newDealer = rotateDealer(gameState.dealer_position ?? seats[0]!, seats)
        const dealerIdx = seats.indexOf(newDealer)
        const rotated = dealerIdx <= 0 ? seats : [...seats.slice(dealerIdx), ...seats.slice(0, dealerIdx)]
        const newBlinds = computeBlindSetup(rotated, players.length)
        newBlinds.dealerPosition = newDealer

        const sb = newBlinds.useSingleBlind ? 0 : room.small_blind
        const bb = room.big_blind
        let potMain = 0

        for (const p of players) {
          let chips = p.chips + (p.player_id === winnerId ? potAmount : 0)
          let currentBet = 0
          if (p.position === newBlinds.smallBlindPosition && p.position === newBlinds.bigBlindPosition) {
            const posted = Math.min(chips, sb + bb)
            chips -= posted
            currentBet = posted
            potMain += posted
          } else if (p.position === newBlinds.smallBlindPosition) {
            const posted = Math.min(chips, sb)
            chips -= posted
            currentBet = posted
            potMain += posted
          } else if (p.position === newBlinds.bigBlindPosition) {
            const posted = Math.min(chips, bb)
            chips -= posted
            currentBet = posted
            potMain += posted
          }
          await supabase
            .from('poker_players')
            .update({
              chips,
              current_bet: currentBet,
              has_folded: false,
              has_acted: false,
              is_all_in: chips === 0 && currentBet > 0,
            })
            .eq('room_pin', pin)
            .eq('player_id', p.player_id)
        }

        await supabase
          .from('poker_game_state')
          .update({
            hand_number: (gameState.hand_number ?? 1) + 1,
            betting_round: 'pre-flop',
            current_bet: bb,
            dealer_position: newDealer,
            small_blind_position: newBlinds.smallBlindPosition,
            big_blind_position: newBlinds.bigBlindPosition,
            action_on: newBlinds.actionOn,
            pot_main: potMain,
            pot_side_pots: [],
            community_cards: [],
            is_game_active: true,
          })
          .eq('room_pin', pin)

        return NextResponse.json({ success: true })
      }

      case 'adjust_chips': {
        if (actionData.hostId !== room.host_id) {
          return NextResponse.json({ error: 'Only host can adjust chips' }, { status: 403 })
        }

        const { targetPlayerId, chips: newChips } = actionData as {
          targetPlayerId?: string
          chips?: number
        }

        if (!targetPlayerId || newChips === undefined) {
          return NextResponse.json({ error: 'Player ID and chip amount required' }, { status: 400 })
        }

        const chips = Math.max(0, Math.floor(Number(newChips)))
        if (Number.isNaN(chips)) {
          return NextResponse.json({ error: 'Invalid chip amount' }, { status: 400 })
        }

        const { error: adjustError } = await supabase
          .from('poker_players')
          .update({ chips })
          .eq('room_pin', pin)
          .eq('player_id', targetPlayerId)

        if (adjustError) {
          return NextResponse.json({ error: 'Failed to adjust chips' }, { status: 500 })
        }

        await supabase
          .from('poker_rooms')
          .update({ last_activity: new Date().toISOString() })
          .eq('pin', pin)

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    const { pin } = await params
    const body = await request.json()
    const { timer_per_turn, hostId } = body

    if (!validateRoomPin(pin)) {
      return NextResponse.json({ error: 'Invalid room PIN' }, { status: 400 })
    }

    // Check if room exists
    const { data: room, error: roomError } = await supabase
      .from('poker_rooms')
      .select('*')
      .eq('pin', pin)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Only host can update
    if (hostId !== room.host_id) {
      return NextResponse.json({ error: 'Only host can update settings' }, { status: 403 })
    }

    // Validate timer
    if (timer_per_turn !== undefined) {
      const timer = parseInt(timer_per_turn)
      if (isNaN(timer) || timer < 5 || timer > 300) {
        return NextResponse.json({ error: 'Timer must be between 5 and 300 seconds' }, { status: 400 })
      }

      const updateData: {
        last_activity: string
        timer_per_turn?: number
      } = {
        last_activity: new Date().toISOString(),
        timer_per_turn: timer,
      }
      
      const { error: updateError } = await supabase
        .from('poker_rooms')
        .update(updateData)
        .eq('pin', pin)

      if (updateError) {
        if (!(updateError.message?.includes('column') && updateError.message?.includes('timer_per_turn'))) {
          return NextResponse.json({ error: 'Failed to update timer' }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
