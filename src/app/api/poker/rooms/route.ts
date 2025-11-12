import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateRoomPin } from '@/lib/poker'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hostName, smallBlind = 5, bigBlind = 10 } = body

    if (!hostName || typeof hostName !== 'string' || hostName.trim().length === 0) {
      return NextResponse.json({ error: 'Host name is required' }, { status: 400 })
    }

    // Generate unique 4-digit PIN
    let pin: string
    let attempts = 0
    do {
      pin = generateRoomPin()
      const { data: existing } = await supabase
        .from('poker_rooms')
        .select('pin')
        .eq('pin', pin)
        .single()
      if (!existing) break
      attempts++
    } while (attempts < 100)

    if (attempts >= 100) {
      return NextResponse.json({ error: 'Failed to generate unique room PIN' }, { status: 500 })
    }

    const hostId = uuidv4()
    const roomId = uuidv4()

    // Create room
    const { data: room, error: roomError } = await supabase
      .from('poker_rooms')
      .insert({
        id: roomId,
        pin,
        host_id: hostId,
        small_blind: smallBlind,
        big_blind: bigBlind,
        status: 'waiting',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (roomError) {
      console.error('Error creating room:', roomError)
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
    }

    // Create host player
    const { error: playerError } = await supabase
      .from('poker_players')
      .insert({
        id: uuidv4(),
        room_pin: pin,
        player_id: hostId,
        name: hostName.trim(),
        chips: 0,
        position: 0,
        is_active: true,
        is_all_in: false,
        current_bet: 0,
        has_folded: false,
        has_acted: false,
      })

    if (playerError) {
      console.error('Error creating host player:', playerError)
      // Clean up room
      await supabase.from('poker_rooms').delete().eq('pin', pin)
      return NextResponse.json({ error: 'Failed to create host player' }, { status: 500 })
    }

    return NextResponse.json({
      pin,
      hostId,
      room: {
        ...room,
        hostId,
      },
    })
  } catch (error) {
    console.error('Error in POST /api/poker/rooms:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

