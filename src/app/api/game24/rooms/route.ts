import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { GAME24_MAX_PLAYERS, generateRoomPin } from '@/lib/game24'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hostName } = body

    if (!hostName || typeof hostName !== 'string' || hostName.trim().length === 0) {
      return NextResponse.json({ error: 'Host name is required' }, { status: 400 })
    }

    const hostId = uuidv4()
    const roomId = uuidv4()
    const now = new Date().toISOString()
    let finalRoom:
      | {
          id: string
          pin: string
          host_id: string
          status: string
          round_number: number
          current_round_started_at: string | null
          intermission_until: string | null
          max_players: number
          created_at: string
          updated_at: string
          last_activity: string
        }
      | null = null

    for (let attempt = 0; attempt < 8 && !finalRoom; attempt++) {
      const pin = generateRoomPin()
      const baseRoom = {
        id: roomId,
        pin,
        host_id: hostId,
        status: 'waiting',
        round_number: 0,
        current_round_started_at: null,
        intermission_until: null,
        max_players: GAME24_MAX_PLAYERS,
        created_at: now,
        updated_at: now,
        last_activity: now,
      }

      const { data: room, error: roomError } = await supabase.from('game24_rooms').insert(baseRoom).select().single()
      if (room) {
        finalRoom = room
        break
      }

      if (!roomError?.code?.toString().includes('23505') && !roomError?.message?.includes('duplicate')) {
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
      }
    }

    if (!finalRoom) {
      return NextResponse.json({ error: 'Failed to generate unique room PIN' }, { status: 500 })
    }

    const playerId = uuidv4()
    const { error: playerError } = await supabase.from('game24_players').insert({
      id: uuidv4(),
      room_pin: finalRoom.pin,
      player_id: playerId,
      name: hostName.trim(),
      score: 0,
      is_connected: true,
    })

    if (playerError) {
      await supabase.from('game24_rooms').delete().eq('pin', finalRoom.pin)
      return NextResponse.json({ error: 'Failed to create host player' }, { status: 500 })
    }

    return NextResponse.json({
      pin: finalRoom.pin,
      hostId,
      playerId,
      room: {
        ...finalRoom,
        hostId,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

