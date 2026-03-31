import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { generateRoomPin } from '@/lib/poker'
import { PARTY_MAX_PLAYERS_DEFAULT } from '@/lib/party/constants'
import type { PartyGameKind } from '@/lib/party/types'

const KINDS: PartyGameKind[] = ['quiplash', 'fibbage', 'eay']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hostName, gameKind } = body as { hostName?: string; gameKind?: string }

    if (!hostName || typeof hostName !== 'string' || hostName.trim().length === 0) {
      return NextResponse.json({ error: 'Host name is required' }, { status: 400 })
    }
    if (!gameKind || !KINDS.includes(gameKind as PartyGameKind)) {
      return NextResponse.json({ error: 'gameKind must be quiplash, fibbage, or eay' }, { status: 400 })
    }

    const hostId = uuidv4()
    const now = new Date().toISOString()
    let finalPin: string | null = null

    for (let attempt = 0; attempt < 8 && !finalPin; attempt++) {
      const pin = generateRoomPin()
      const { data: room, error } = await supabase
        .from('party_rooms')
        .insert({
          id: uuidv4(),
          pin,
          host_id: hostId,
          game_kind: gameKind,
          phase: 'lobby',
          round_index: 0,
          step_index: 0,
          deadline_at: null,
          settings: {},
          version: 0,
          max_players: PARTY_MAX_PLAYERS_DEFAULT,
          created_at: now,
          updated_at: now,
          last_activity: now,
        })
        .select()
        .single()

      if (room) {
        finalPin = pin
        break
      }
      if (!error?.code?.toString().includes('23505') && !error?.message?.includes('duplicate')) {
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
      }
    }

    if (!finalPin) {
      return NextResponse.json({ error: 'Failed to generate unique room PIN' }, { status: 500 })
    }

    const playerId = uuidv4()
    const { error: playerError } = await supabase.from('party_players').insert({
      id: uuidv4(),
      room_pin: finalPin,
      player_id: playerId,
      name: hostName.trim(),
      score: 0,
      is_connected: true,
      joined_at: now,
    })

    if (playerError) {
      await supabase.from('party_rooms').delete().eq('pin', finalPin)
      return NextResponse.json({ error: 'Failed to create host player' }, { status: 500 })
    }

    return NextResponse.json({ pin: finalPin, hostId, playerId })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
