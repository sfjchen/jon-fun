import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateRoomPin } from '@/lib/poker'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hostName, smallBlind = 5, bigBlind = 10, timerPerTurn = 40 } = body

    if (!hostName || typeof hostName !== 'string' || hostName.trim().length === 0) {
      return NextResponse.json({ error: 'Host name is required' }, { status: 400 })
    }

    const hostId = uuidv4()
    const roomId = uuidv4()

    // Create room with minimal round-trips: generate PIN, insert, retry on unique conflicts
    const now = new Date().toISOString()
    let finalRoom:
      | {
          id: string
          pin: string
          host_id: string
          small_blind: number
          big_blind: number
          status: string
          created_at: string
          last_activity: string
          timer_per_turn?: number
        }
      | null = null

    for (let attempt = 0; attempt < 8 && !finalRoom; attempt++) {
      const pin = generateRoomPin()
      const baseRoomData = {
        id: roomId,
        pin,
        host_id: hostId,
        small_blind: smallBlind,
        big_blind: bigBlind,
        status: 'waiting',
        created_at: now,
        last_activity: now,
        timer_per_turn: timerPerTurn,
      }

      const tryInsert = async (data: typeof baseRoomData) =>
        supabase.from('poker_rooms').insert(data).select().single()

      const { data: room, error: roomError } = await tryInsert(baseRoomData)

      if (room) {
        finalRoom = room
        break
      }

      if (roomError?.message?.includes('column') && roomError.message.includes('timer_per_turn')) {
        const { data: retryRoom, error: retryError } = await tryInsert({
          ...baseRoomData,
          timer_per_turn: undefined,
        })
        if (retryRoom) {
          finalRoom = retryRoom
          break
        }
        if (!retryError?.code?.toString().includes('23505') && !retryError?.message?.includes('duplicate')) {
          return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
        }
      } else if (!roomError?.code?.toString().includes('23505') && !roomError?.message?.includes('duplicate')) {
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
      }
    }

    if (!finalRoom) {
      return NextResponse.json({ error: 'Failed to generate unique room PIN' }, { status: 500 })
    }

    // Create host player
    const { error: playerError } = await supabase
      .from('poker_players')
      .insert({
        id: uuidv4(),
        room_pin: finalRoom.pin,
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
      await supabase.from('poker_rooms').delete().eq('pin', finalRoom.pin)
      return NextResponse.json({ error: 'Failed to create host player' }, { status: 500 })
    }

    return NextResponse.json({
      pin: finalRoom.pin,
      hostId,
      room: {
        ...finalRoom,
        hostId,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

