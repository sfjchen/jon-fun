import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateRoomPin } from '@/lib/poker'
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
      console.error('Error fetching players:', playersError)
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
  } catch (error) {
    console.error('Error in GET /api/poker/rooms/[pin]:', error)
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
        const { error: joinError } = await supabase
          .from('poker_players')
          .insert({
            id: uuidv4(),
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
          console.error('Error joining room:', joinError)
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
        // Only host can start
        if (actionData.hostId !== room.host_id) {
          return NextResponse.json({ error: 'Only host can start the game' }, { status: 403 })
        }

        // Get all active players
        const { data: players } = await supabase
          .from('poker_players')
          .select('*')
          .eq('room_pin', pin)
          .eq('is_active', true)
          .order('position', { ascending: true })

        if (!players || players.length < 2) {
          return NextResponse.json({ error: 'Need at least 2 players to start' }, { status: 400 })
        }

        // Update room status
        const { error: updateError } = await supabase
          .from('poker_rooms')
          .update({ status: 'active', last_activity: new Date().toISOString() })
          .eq('pin', pin)

        if (updateError) {
          console.error('Error starting game:', updateError)
          return NextResponse.json({ error: 'Failed to start game' }, { status: 500 })
        }

        // Initialize game state
        const { error: stateError } = await supabase
          .from('poker_game_state')
          .insert({
            room_pin: pin,
            hand_number: 1,
            betting_round: 'pre-flop',
            current_bet: room.big_blind,
            dealer_position: 0,
            small_blind_position: 0,
            big_blind_position: 1,
            action_on: 2,
            small_blind: room.small_blind,
            big_blind: room.big_blind,
            pot_main: 0,
            pot_side_pots: [],
            community_cards: [],
            is_game_active: true,
          })

        if (stateError) {
          console.error('Error initializing game state:', stateError)
        }

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in POST /api/poker/rooms/[pin]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
