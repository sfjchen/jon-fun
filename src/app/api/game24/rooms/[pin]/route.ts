import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { GAME24_MAX_PLAYERS, Game24Status, validateRoomPin } from '@/lib/game24'
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    const { pin } = await params

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

    const { data: players, error: playersError } = await supabase
      .from('game24_players')
      .select('*')
      .eq('room_pin', pin)
      .order('joined_at', { ascending: true })

    if (playersError) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
    }

    let round = null
    const roundScores: Record<string, number> = {}
    if (room.round_number > 0) {
      const { data: roundData } = await supabase
        .from('game24_rounds')
        .select('*')
        .eq('room_pin', pin)
        .eq('round_number', room.round_number)
        .single()
      round = roundData ?? null

      const { data: submissions } = await supabase
        .from('game24_submissions')
        .select('player_id, score_awarded')
        .eq('room_pin', pin)
        .eq('round_number', room.round_number)
        .eq('is_correct', true)

      if (submissions) {
        submissions.forEach((sub) => {
          if (sub.player_id) {
            roundScores[sub.player_id] = sub.score_awarded ?? 0
          }
        })
      }
    }

    let playerCorrectCounts: Record<string, number> = {}
    if (room.status === 'finished' || (room.round_number ?? 0) > 0) {
      const { data: allCorrect } = await supabase
        .from('game24_submissions')
        .select('player_id, round_number')
        .eq('room_pin', pin)
        .eq('is_correct', true)
      const byPlayer: Record<string, Set<number>> = {}
      allCorrect?.forEach((row) => {
        if (!row.player_id || row.round_number == null) return
        if (!byPlayer[row.player_id]) byPlayer[row.player_id] = new Set()
        byPlayer[row.player_id]!.add(row.round_number)
      })
      playerCorrectCounts = Object.fromEntries(
        Object.entries(byPlayer).map(([pid, rounds]) => [pid, rounds.size])
      )
    }

    return NextResponse.json({
      room,
      players: players || [],
      round,
      roundScores,
      playerCorrectCounts,
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
    const { action, playerName } = body

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

    const now = new Date().toISOString()

    switch (action) {
      case 'join': {
        if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
          return NextResponse.json({ error: 'Player name is required' }, { status: 400 })
        }

        const { count } = await supabase
          .from('game24_players')
          .select('*', { count: 'exact', head: true })
          .eq('room_pin', pin)

        if ((count ?? 0) >= (room.max_players ?? GAME24_MAX_PLAYERS)) {
          return NextResponse.json({ error: `Room is full (max ${room.max_players ?? GAME24_MAX_PLAYERS} players)` }, { status: 400 })
        }

        const playerId = uuidv4()
        const { error: joinError } = await supabase.from('game24_players').insert({
          id: uuidv4(),
          room_pin: pin,
          player_id: playerId,
          name: playerName.trim(),
          score: 0,
          is_connected: true,
          joined_at: now,
        })

        if (joinError) {
          return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
        }

        // If no host, first joiner becomes host
        if (!room.host_id) {
          await supabase.from('game24_rooms').update({ host_id: playerId, last_activity: now }).eq('pin', pin)
        } else {
          await supabase.from('game24_rooms').update({ last_activity: now }).eq('pin', pin)
        }

        return NextResponse.json({ playerId })
      }

      case 'start': {
        const { playerId } = body
        if (!playerId) {
          return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
        }

        if (room.status !== 'waiting') {
          const { data: existingRound } = await supabase
            .from('game24_rounds')
            .select('*')
            .eq('room_pin', pin)
            .eq('round_number', room.round_number || 1)
            .single()
          return NextResponse.json({
            success: true,
            status: room.status,
            round: existingRound ?? null,
          })
        }

        const { data: players } = await supabase
          .from('game24_players')
          .select('*')
          .eq('room_pin', pin)

        if (!players || players.length < 1) {
          return NextResponse.json({ error: 'Need at least 1 player to start' }, { status: 400 })
        }

        // Reset prior state but keep players
        await Promise.all([
          supabase.from('game24_submissions').delete().eq('room_pin', pin),
          supabase.from('game24_rounds').delete().eq('room_pin', pin),
          supabase.from('game24_players').update({ score: 0, is_connected: true }).eq('room_pin', pin),
        ])

        const numbers = generateSolvableNumbers()
        const roundStart = now

        const { error: roundError } = await supabase
          .from('game24_rounds')
          .upsert(
            {
              id: uuidv4(),
              room_pin: pin,
              round_number: 1,
              numbers,
              started_at: roundStart,
            },
            { onConflict: 'room_pin,round_number' }
          )

        const { error: roomUpdateError } = await supabase
          .from('game24_rooms')
          .update({
            status: 'active',
            round_number: 1,
            current_round_started_at: roundStart,
            intermission_until: null,
            last_activity: roundStart,
            updated_at: roundStart,
          })
          .eq('pin', pin)

        if (roundError || roomUpdateError) {
          // If another concurrent start already created the round, return existing state instead of error
          const { data: existingRound } = await supabase
            .from('game24_rounds')
            .select('*')
            .eq('room_pin', pin)
            .eq('round_number', 1)
            .single()
          return NextResponse.json({
            success: true,
            round: existingRound ?? { round_number: 1, numbers, started_at: roundStart },
          })
        }

        return NextResponse.json({ success: true, round: { round_number: 1, numbers, started_at: roundStart } })
      }

      case 'play-again': {
        await Promise.all([
          supabase.from('game24_submissions').delete().eq('room_pin', pin),
          supabase.from('game24_rounds').delete().eq('room_pin', pin),
          supabase.from('game24_players').update({ score: 0 }).eq('room_pin', pin),
        ])

        await supabase
          .from('game24_rooms')
          .update({
            status: 'waiting' as Game24Status,
            round_number: 0,
            current_round_started_at: null,
            intermission_until: null,
            last_activity: now,
            updated_at: now,
          })
          .eq('pin', pin)

        return NextResponse.json({ pin })
      }

      case 'leave': {
        const { playerId } = body
        if (!playerId) {
          return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
        }

        await supabase.from('game24_players').delete().eq('room_pin', pin).eq('player_id', playerId)

        const { count: remaining } = await supabase
          .from('game24_players')
          .select('*', { count: 'exact', head: true })
          .eq('room_pin', pin)

        if ((remaining ?? 0) === 0) {
          await supabase.from('game24_rooms').delete().eq('pin', pin)
        } else {
          const nowIso = new Date().toISOString()
          await supabase.from('game24_rooms').update({ last_activity: nowIso }).eq('pin', pin)
        }

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

