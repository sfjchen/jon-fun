import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { GAME24_ROUND_DURATION_MS, scoreForElapsed, validateRoomPin } from '@/lib/game24'

const isExpressionSafe = (expression: string) => /^[\d+\-*/().\s]+$/.test(expression)

const extractNumbers = (expression: string): number[] =>
  (expression.match(/\d+/g) || []).map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n))

const multisetEquals = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort((x, y) => x - y)
  const sortedB = [...b].sort((x, y) => x - y)
  return sortedA.every((v, i) => v === sortedB[i])
}

const evaluateExpression = (expression: string): number | null => {
  try {
    const fn = new Function(`return (${expression});`)
    const result = fn()
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pin, playerId, expression } = body

    if (!validateRoomPin(pin)) {
      return NextResponse.json({ error: 'Invalid room PIN' }, { status: 400 })
    }

    if (!playerId || !expression || typeof expression !== 'string') {
      return NextResponse.json({ error: 'playerId and expression are required' }, { status: 400 })
    }

    const normalizedExpression = expression.replace(/×/g, '*').replace(/÷/g, '/')

    if (!isExpressionSafe(normalizedExpression)) {
      return NextResponse.json({ error: 'Invalid characters in expression' }, { status: 400 })
    }

    const { data: room, error: roomError } = await supabase
      .from('game24_rooms')
      .select('*')
      .eq('pin', pin)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    if (room.status !== 'active' || room.round_number < 1) {
      return NextResponse.json({ error: 'Round is not active' }, { status: 409 })
    }

    const { data: player, error: playerError } = await supabase
      .from('game24_players')
      .select('*')
      .eq('room_pin', pin)
      .eq('player_id', playerId)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const { data: round, error: roundError } = await supabase
      .from('game24_rounds')
      .select('*')
      .eq('room_pin', pin)
      .eq('round_number', room.round_number)
      .single()

    if (roundError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    const usedNumbers = extractNumbers(normalizedExpression)
    const roundNumbers = Array.isArray(round.numbers) ? round.numbers.map((n: number) => Number(n)) : []

    if (!multisetEquals(usedNumbers, roundNumbers)) {
      return NextResponse.json({ error: 'Expression must use the provided numbers' }, { status: 400 })
    }

    const result = evaluateExpression(normalizedExpression)
    if (result === null || Math.abs(result - 24) > 0.001) {
      return NextResponse.json({ error: 'Expression does not evaluate to 24' }, { status: 400 })
    }

    const { count: existing } = await supabase
      .from('game24_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('room_pin', pin)
      .eq('round_number', room.round_number)
      .eq('player_id', playerId)
      .eq('is_correct', true)

    if ((existing ?? 0) > 0) {
      return NextResponse.json({ success: true, scoreAwarded: 0 })
    }

    const startedAt = room.current_round_started_at ? new Date(room.current_round_started_at).getTime() : null
    const nowMs = Date.now()
    const elapsedMs = startedAt ? nowMs - startedAt : GAME24_ROUND_DURATION_MS
    const scoreAwarded = scoreForElapsed(elapsedMs)

    const nowIso = new Date(nowMs).toISOString()

    const { error: insertError } = await supabase.from('game24_submissions').insert({
      room_pin: pin,
      round_number: room.round_number,
      player_id: playerId,
      expression,
      is_correct: true,
      score_awarded: scoreAwarded,
      submitted_at: nowIso,
    })

    if (insertError) {
      return NextResponse.json({ error: 'Failed to record submission' }, { status: 500 })
    }

    await Promise.all([
      supabase
        .from('game24_players')
        .update({ score: (player.score ?? 0) + scoreAwarded, is_connected: true })
        .eq('room_pin', pin)
        .eq('player_id', playerId),
      supabase.from('game24_rooms').update({ last_activity: nowIso }).eq('pin', pin),
    ])

    return NextResponse.json({ success: true, scoreAwarded })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

