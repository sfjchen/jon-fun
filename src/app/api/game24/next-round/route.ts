import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import {
  GAME24_INTERMISSION_MS,
  GAME24_MAX_ROUNDS,
  GAME24_ROUND_DURATION_MS,
  Game24Status,
  validateRoomPin,
} from '@/lib/game24'
import { recordMatch } from '@/lib/match-results'
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

    const { data: room, error: roomError } = await supabase.from('game24_rooms').select('*').eq('pin', pin).single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const now = new Date()
    const nowIso = now.toISOString()

    if (room.status === 'finished') {
      return NextResponse.json({ status: 'finished' as Game24Status })
    }

    if (room.status === 'active') {
      const roundStart = room.current_round_started_at ? new Date(room.current_round_started_at).getTime() : null
      if (!roundStart) {
        return NextResponse.json({ error: 'Round start missing' }, { status: 409 })
      }
      const elapsed = now.getTime() - roundStart
      const remaining = Math.max(0, GAME24_ROUND_DURATION_MS - elapsed)
      if (remaining > 0) {
        return NextResponse.json({ status: 'active', waitMs: remaining })
      }

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
        const { data: done } = await supabase
          .from('game24_rooms')
          .update({
            status: 'finished' as Game24Status,
            intermission_until: null,
            last_activity: nowIso,
            updated_at: nowIso,
          })
          .eq('pin', pin)
          .eq('status', 'intermission')
          .select('pin')

        // Only the request that wins the status change records the match.
        if (done?.length) {
          const [{ data: rounds }, { data: ps }, { data: subs }] = await Promise.all([
            supabase.from('game24_rounds').select('round_number, started_at').eq('room_pin', pin),
            supabase.from('game24_players').select('player_id, name, score').eq('room_pin', pin),
            supabase
              .from('game24_submissions')
              .select('player_id, round_number, submitted_at')
              .eq('room_pin', pin)
              .eq('is_correct', true),
          ])
          const starts = new Map((rounds ?? []).map((r) => [r.round_number, new Date(r.started_at).getTime()]))
          const startedAt = new Date(Math.min(...starts.values())).toISOString()
          await recordMatch(
            '24',
            pin,
            startedAt,
            (ps ?? []).map((p) => {
              const ms = (subs ?? [])
                .filter((s) => s.player_id === p.player_id && starts.has(s.round_number))
                .map((s) => new Date(s.submitted_at).getTime() - starts.get(s.round_number)!)
              return {
                id: p.player_id,
                name: p.name,
                score: p.score ?? 0,
                best: ms.length ? Math.min(...ms) : null,
                avg: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null,
              }
            }),
          )
        }

        return NextResponse.json({ status: 'finished' as Game24Status })
      }

      const nextRound = (room.round_number ?? 0) + 1
      const numbers = generateSolvableNumbers()

      const { error: roundError } = await supabase.from('game24_rounds').upsert(
        {
          id: uuidv4(),
          room_pin: pin,
          round_number: nextRound,
          numbers,
          started_at: nowIso,
        },
        { onConflict: 'room_pin,round_number' },
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
