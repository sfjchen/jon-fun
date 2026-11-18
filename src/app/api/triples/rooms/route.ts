/**
 * Creates a Triples room with a fresh 4-digit PIN and its host as the first player.
 */

import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabase'
import { generateRoomPin } from '@/lib/triples'
import { playerToken,toRoom, type RoomRow } from '@/lib/triples-server'

/**
 * Creates the room, retrying on a PIN collision, and returns the host's player id.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 24) : ''
  if (!name) return NextResponse.json({ error: 'Enter your name' }, { status: 400 })
  const playerId = uuidv4()
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabaseAdmin
      .from('triples_rooms')
      .insert({ pin: generateRoomPin(), host_id: playerId, players: [{ id: playerId, name, score: 0, misses: 0, authVersion:2 }] })
      .select()
      .single()
    if (data) return NextResponse.json({ playerId, playerToken:playerToken(data.pin,playerId), room: toRoom(data as RoomRow) })
    if (error?.code !== '23505') return NextResponse.json({ error: 'Could not create a room' }, { status: 500 })
  }
  return NextResponse.json({ error: 'Could not find a free PIN. Try again.' }, { status: 500 })
}
