import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { validateRoomPin } from '@/lib/poker'
import { PARTY_MAX_PLAYERS_DEFAULT } from '@/lib/party/constants'
import { seedQuiplashRound1 } from '@/lib/party/quiplash-start'
import { seedFibbageGame } from '@/lib/party/fibbage-start'
import { seedEayIntake } from '@/lib/party/eay-start'

async function loadPartyRoom(pin: string) {
  const { data: room, error: roomError } = await supabase.from('party_rooms').select('*').eq('pin', pin).single()
  if (roomError || !room) return { room: null as null, err: 'Room not found' as const }
  const { data: players, error: playersError } = await supabase
    .from('party_players')
    .select('*')
    .eq('room_pin', pin)
    .order('joined_at', { ascending: true })
  if (playersError) return { room: null as null, err: 'Failed to fetch players' as const }
  return { room, players: players ?? [], err: null as null }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  try {
    const { pin } = await params
    if (!validateRoomPin(pin)) {
      return NextResponse.json({ error: 'Invalid room PIN' }, { status: 400 })
    }

    const { room, players, err } = await loadPartyRoom(pin)
    if (err || !room) {
      return NextResponse.json({ error: err ?? 'Room not found' }, { status: 404 })
    }

    const kind = room.game_kind as string

    if (kind === 'quiplash') {
      const { data: matchups } = await supabase
        .from('party_quiplash_matchups')
        .select('*')
        .eq('room_pin', pin)
        .order('round_index', { ascending: true })
        .order('sort_order', { ascending: true })
      const matchupIds = (matchups ?? []).map((m) => m.id)
      const [{ data: answers }, { data: votes }, { data: finalPrompt }, { data: finalAnswers }, { data: finalVotes }] =
        await Promise.all([
          supabase.from('party_quiplash_answers').select('*').eq('room_pin', pin),
          matchupIds.length
            ? supabase.from('party_quiplash_votes').select('*').in('matchup_id', matchupIds)
            : Promise.resolve({ data: [] as { id: string; matchup_id: string; voter_player_id: string; choice: number }[] }),
          supabase.from('party_quiplash_final_prompt').select('*').eq('room_pin', pin).maybeSingle(),
          supabase.from('party_quiplash_final_answers').select('*').eq('room_pin', pin),
          supabase.from('party_quiplash_final_votes').select('*').eq('room_pin', pin),
        ])

      return NextResponse.json({
        room,
        players,
        quiplash: {
          matchups: matchups ?? [],
          answers: answers ?? [],
          votes: votes ?? [],
          finalPrompt: finalPrompt ?? null,
          finalAnswers: finalAnswers ?? [],
          finalVotes: finalVotes ?? [],
        },
      })
    }

    if (kind === 'fibbage') {
      const [{ data: rounds }, { data: allLies }, { data: allPicks }, { data: allLikes }] = await Promise.all([
        supabase.from('party_fibbage_rounds').select('*').eq('room_pin', pin).order('round_index'),
        supabase.from('party_fibbage_lies').select('*'),
        supabase.from('party_fibbage_picks').select('*'),
        supabase.from('party_fibbage_likes').select('*'),
      ])
      const roundIds = new Set((rounds ?? []).map((r) => r.id))
      return NextResponse.json({
        room,
        players,
        fibbage: {
          rounds: rounds ?? [],
          lies: (allLies ?? []).filter((l) => roundIds.has(l.round_id)),
          picks: (allPicks ?? []).filter((p) => roundIds.has(p.round_id)),
          likes: (allLikes ?? []).filter((l) => roundIds.has(l.round_id)),
        },
      })
    }

    const [{ data: intake }, { data: rounds }, { data: allLies }, { data: allPicks }, { data: allLikes }, { data: finals }, { data: finalPicks }] =
      await Promise.all([
        supabase.from('party_eay_intake').select('*').eq('room_pin', pin),
        supabase.from('party_eay_rounds').select('*').eq('room_pin', pin).order('round_index'),
        supabase.from('party_eay_lies').select('*'),
        supabase.from('party_eay_picks').select('*'),
        supabase.from('party_eay_likes').select('*'),
        supabase.from('party_eay_final').select('*').eq('room_pin', pin),
        supabase.from('party_eay_final_picks').select('*').eq('room_pin', pin),
      ])
    const eayRoundIds = new Set((rounds ?? []).map((r) => r.id))
    return NextResponse.json({
      room,
      players,
      eay: {
        intake: intake ?? [],
        rounds: rounds ?? [],
        lies: (allLies ?? []).filter((l) => eayRoundIds.has(l.round_id)),
        picks: (allPicks ?? []).filter((p) => eayRoundIds.has(p.round_id)),
        likes: (allLikes ?? []).filter((l) => eayRoundIds.has(l.round_id)),
        finals: finals ?? [],
        finalPicks: finalPicks ?? [],
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  try {
    const { pin } = await params
    const body = await request.json()
    const { action, playerName, playerId } = body as {
      action?: string
      playerName?: string
      playerId?: string
    }

    if (!validateRoomPin(pin)) {
      return NextResponse.json({ error: 'Invalid room PIN' }, { status: 400 })
    }

    const { data: room, error: roomError } = await supabase.from('party_rooms').select('*').eq('pin', pin).single()
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
          .from('party_players')
          .select('*', { count: 'exact', head: true })
          .eq('room_pin', pin)
        if ((count ?? 0) >= (room.max_players ?? PARTY_MAX_PLAYERS_DEFAULT)) {
          return NextResponse.json({ error: 'Room is full' }, { status: 400 })
        }
        const newPlayerId = uuidv4()
        const { error: joinError } = await supabase.from('party_players').insert({
          id: uuidv4(),
          room_pin: pin,
          player_id: newPlayerId,
          name: playerName.trim(),
          score: 0,
          is_connected: true,
          joined_at: now,
        })
        if (joinError) {
          return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
        }
        if (!room.host_id) {
          await supabase.from('party_rooms').update({ host_id: newPlayerId, last_activity: now }).eq('pin', pin)
        } else {
          await supabase.from('party_rooms').update({ last_activity: now }).eq('pin', pin)
        }
        return NextResponse.json({ playerId: newPlayerId })
      }

      case 'start': {
        if (!playerId) {
          return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
        }
        if (room.host_id !== playerId) {
          return NextResponse.json({ error: 'Only host can start' }, { status: 403 })
        }
        if (room.phase !== 'lobby') {
          return NextResponse.json({ success: true, alreadyStarted: true })
        }
        const { data: players } = await supabase.from('party_players').select('player_id').eq('room_pin', pin)
        const n = players?.length ?? 0
        const min = room.game_kind === 'fibbage' ? 2 : 3
        if (n < min) {
          return NextResponse.json({ error: `Need at least ${min} players` }, { status: 400 })
        }
        await supabase.from('party_players').update({ score: 0 }).eq('room_pin', pin)
        const playerIds = (players ?? []).map((p) => p.player_id)

        if (room.game_kind === 'quiplash') {
          const se = await seedQuiplashRound1(pin, playerIds, now)
          if (se.error) {
            return NextResponse.json({ error: se.error }, { status: 500 })
          }
        } else if (room.game_kind === 'fibbage') {
          const se = await seedFibbageGame(pin, playerIds, now)
          if (se.error) {
            return NextResponse.json({ error: se.error }, { status: 500 })
          }
        } else {
          const se = await seedEayIntake(pin, now)
          if (se.error) {
            return NextResponse.json({ error: se.error }, { status: 500 })
          }
        }

        return NextResponse.json({ success: true })
      }

      case 'leave': {
        if (!playerId) {
          return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
        }
        await supabase.from('party_players').delete().eq('room_pin', pin).eq('player_id', playerId)
        const { count: remaining } = await supabase
          .from('party_players')
          .select('*', { count: 'exact', head: true })
          .eq('room_pin', pin)
        if ((remaining ?? 0) === 0) {
          await supabase.from('party_rooms').delete().eq('pin', pin)
        } else {
          await supabase.from('party_rooms').update({ last_activity: now }).eq('pin', pin)
        }
        return NextResponse.json({ success: true })
      }

      case 'play-again': {
        if (!playerId) {
          return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
        }
        if (room.host_id !== playerId) {
          return NextResponse.json({ error: 'Only host can reset' }, { status: 403 })
        }
        const mids = (await supabase.from('party_quiplash_matchups').select('id').eq('room_pin', pin)).data?.map((m) => m.id) ?? []
        if (mids.length > 0) {
          await supabase.from('party_quiplash_votes').delete().in('matchup_id', mids)
        }
        await supabase.from('party_quiplash_answers').delete().eq('room_pin', pin)
        await supabase.from('party_quiplash_matchups').delete().eq('room_pin', pin)
        await supabase.from('party_quiplash_final_votes').delete().eq('room_pin', pin)
        await supabase.from('party_quiplash_final_answers').delete().eq('room_pin', pin)
        await supabase.from('party_quiplash_final_prompt').delete().eq('room_pin', pin)

        const fibRounds = (await supabase.from('party_fibbage_rounds').select('id').eq('room_pin', pin)).data ?? []
        for (const r of fibRounds) {
          await supabase.from('party_fibbage_likes').delete().eq('round_id', r.id)
          await supabase.from('party_fibbage_picks').delete().eq('round_id', r.id)
          await supabase.from('party_fibbage_lies').delete().eq('round_id', r.id)
        }
        await supabase.from('party_fibbage_rounds').delete().eq('room_pin', pin)

        const eayRounds = (await supabase.from('party_eay_rounds').select('id').eq('room_pin', pin)).data ?? []
        for (const r of eayRounds) {
          await supabase.from('party_eay_likes').delete().eq('round_id', r.id)
          await supabase.from('party_eay_picks').delete().eq('round_id', r.id)
          await supabase.from('party_eay_lies').delete().eq('round_id', r.id)
        }
        await supabase.from('party_eay_rounds').delete().eq('room_pin', pin)
        await supabase.from('party_eay_intake').delete().eq('room_pin', pin)
        await supabase.from('party_eay_final_picks').delete().eq('room_pin', pin)
        await supabase.from('party_eay_final').delete().eq('room_pin', pin)

        await supabase.from('party_players').update({ score: 0 }).eq('room_pin', pin)
        await supabase
          .from('party_rooms')
          .update({
            phase: 'lobby',
            round_index: 0,
            step_index: 0,
            deadline_at: null,
            version: (room.version ?? 0) + 1,
            last_activity: now,
            updated_at: now,
          })
          .eq('pin', pin)

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
