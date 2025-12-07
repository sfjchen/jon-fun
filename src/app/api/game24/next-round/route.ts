import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { GAME24_INTERMISSION_MS, GAME24_MAX_ROUNDS, Game24Status, validateRoomPin } from '@/lib/game24'
import { Solver24 } from '@/lib/solver24'

const solver = new Solver24()

const generateSolvableNumbers = (): number[] => {
  let numbers = [4, 6, 8, 1]
  const maxAttempts = 80
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = Array.from({ length: 4 }, () => Math.floor(Math.random() * 9) + 1)
    if (solver.hasSolution(candidate)) {
      numbers = candidate
      break
    }
  }
  return numbers
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pin } = body

    if (!validateRoomPin(pin)) {
      return NextResponse.json({ error: 'Invalid room PIN' }, { status: 400 })
    }

    const { data: room, error: roomError } = await supabase
      .from('game24_rooms')
      .select('*')
      .eq('pin', pin)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const now = new Date()
    const nowIso = now.toISOString()

    if (room.status === 'finished') {
      return NextResponse.json({ status: 'finished' as Game24Status })
    }

    if (room.status === 'active') {
      const intermissionUntil = new Date(now.getTime() + GAME24_INTERMISSION_MS).toISOString()
      const { error: updateError } = await supabase
        .from('game24_rooms')
        .update({
          status: 'intermission' as Game24Status,
          intermission_until: intermissionUntil,
          last_activity: nowIso,
          updated_at: nowIso,
        })
        .eq('pin', pin)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to start intermission' }, { status: 500 })
      }

      return NextResponse.json({ status: 'intermission', intermissionUntil })
    }

    if (room.status === 'intermission') {
      if (room.intermission_until) {
        const waitUntil = new Date(room.intermission_until).getTime()
        if (now.getTime() < waitUntil) {
          return NextResponse.json({ status: 'intermission', waitMs: waitUntil - now.getTime() })
        }
      }

      if (room.round_number >= GAME24_MAX_ROUNDS) {
        await supabase
          .from('game24_rooms')
          .update({
            status: 'finished' as Game24Status,
            intermission_until: null,
            last_activity: nowIso,
            updated_at: nowIso,
          })
          .eq('pin', pin)

        return NextResponse.json({ status: 'finished' as Game24Status })
      }

      const nextRound = (room.round_number ?? 0) + 1
      const numbers = generateSolvableNumbers()

      const { error: roundError } = await supabase
        .from('game24_rounds')
        .upsert(
          {
            id: uuidv4(),
            room_pin: pin,
            round_number: nextRound,
            numbers,
            started_at: nowIso,
          },
          { onConflict: 'room_pin,round_number' }
        )

      if (roundError) {
        return NextResponse.json({ error: 'Failed to create next round' }, { status: 500 })
      }

      const { error: roomUpdateError } = await supabase
        .from('game24_rooms')
        .update({
          status: 'active' as Game24Status,
          round_number: nextRound,
          current_round_started_at: nowIso,
          intermission_until: null,
          last_activity: nowIso,
          updated_at: nowIso,
        })
        .eq('pin', pin)

      if (roomUpdateError) {
        return NextResponse.json({ error: 'Failed to create next round' }, { status: 500 })
      }

      return NextResponse.json({
        status: 'active' as Game24Status,
        round: { round_number: nextRound, numbers, started_at: nowIso },
      })
    }

    return NextResponse.json({ error: 'Invalid room state' }, { status: 409 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

