import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateRoomPin } from '@/lib/poker'
import { ANSWER_MAX_LEN, PARTY_PHASE_SECONDS_DEFAULT, PARTY_VOTE_SECONDS_DEFAULT } from '@/lib/party/constants'
import { QUIPLASH_FINAL_PROMPTS } from '@/lib/party/prompts-quiplash'
import { scoreFinalRound, scoreHeadToHead } from '@/lib/party/quiplash-scoring'
import { seedQuiplashRound2 } from '@/lib/party/quiplash-round2'

async function bumpRoom(pin: string, patch: Record<string, unknown>, nowIso: string) {
  const { data: room } = await supabase.from('party_rooms').select('version').eq('pin', pin).single()
  await supabase
    .from('party_rooms')
    .update({
      ...patch,
      updated_at: nowIso,
      last_activity: nowIso,
      version: (room?.version ?? 0) + 1,
    })
    .eq('pin', pin)
}

async function addScore(pin: string, playerId: string, delta: number) {
  const { data: p } = await supabase.from('party_players').select('score').eq('room_pin', pin).eq('player_id', playerId).single()
  const next = (p?.score ?? 0) + delta
  await supabase.from('party_players').update({ score: next }).eq('room_pin', pin).eq('player_id', playerId)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  try {
    const { pin } = await params
    if (!validateRoomPin(pin)) {
      return NextResponse.json({ error: 'Invalid room PIN' }, { status: 400 })
    }

    const body = await request.json()
    const { action, playerId } = body as { action?: string; playerId?: string }

    if (!playerId) {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
    }

    const { data: room, error: re } = await supabase.from('party_rooms').select('*').eq('pin', pin).single()
    if (re || !room || room.game_kind !== 'quiplash') {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const { data: players } = await supabase.from('party_players').select('*').eq('room_pin', pin).order('joined_at', { ascending: true })
    const playerList = players ?? []
    const now = new Date().toISOString()

    if (action === 'submitAnswer') {
      const { matchupId, body: text } = body as { matchupId?: string; body?: string }
      if (!matchupId || !text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json({ error: 'matchupId and body required' }, { status: 400 })
      }
      const trimmed = text.trim().slice(0, ANSWER_MAX_LEN)
      const phase = room.phase as string
      if (phase !== 'quiplash_1_answer' && phase !== 'quiplash_2_answer') {
        return NextResponse.json({ error: 'Not in answer phase' }, { status: 400 })
      }
      const round = phase === 'quiplash_1_answer' ? 1 : 2
      const { data: m } = await supabase.from('party_quiplash_matchups').select('*').eq('id', matchupId).eq('room_pin', pin).single()
      if (!m || m.round_index !== round) {
        return NextResponse.json({ error: 'Invalid matchup' }, { status: 400 })
      }
      if (m.player_a !== playerId && m.player_b !== playerId) {
        return NextResponse.json({ error: 'Not your matchup' }, { status: 403 })
      }
      await supabase.from('party_quiplash_answers').upsert(
        {
          room_pin: pin,
          round_index: round,
          matchup_id: matchupId,
          player_id: playerId,
          body: trimmed,
          submitted_at: now,
        },
        { onConflict: 'matchup_id,player_id' },
      )

      const { data: allM } = await supabase
        .from('party_quiplash_matchups')
        .select('id')
        .eq('room_pin', pin)
        .eq('round_index', round)
      const ids = (allM ?? []).map((x) => x.id)
      let complete = true
      for (const mid of ids) {
        const { data: ans } = await supabase.from('party_quiplash_answers').select('player_id').eq('matchup_id', mid)
        const set = new Set((ans ?? []).map((a) => a.player_id))
        const { data: mm } = await supabase.from('party_quiplash_matchups').select('player_a,player_b').eq('id', mid).single()
        if (!mm || !set.has(mm.player_a) || !set.has(mm.player_b)) complete = false
      }
      if (complete) {
        const deadline = new Date(Date.now() + PARTY_VOTE_SECONDS_DEFAULT * 1000).toISOString()
        await bumpRoom(
          pin,
          {
            phase: round === 1 ? 'quiplash_1_vote' : 'quiplash_2_vote',
            step_index: 0,
            deadline_at: deadline,
          },
          now,
        )
      } else {
        await supabase.from('party_rooms').update({ last_activity: now }).eq('pin', pin)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'submitVote') {
      const { choice } = body as { choice?: number }
      if (choice !== 0 && choice !== 1) {
        return NextResponse.json({ error: 'choice must be 0 or 1' }, { status: 400 })
      }
      const phase = room.phase as string
      if (phase !== 'quiplash_1_vote' && phase !== 'quiplash_2_vote') {
        return NextResponse.json({ error: 'Not in vote phase' }, { status: 400 })
      }
      const round = phase === 'quiplash_1_vote' ? 1 : 2
      const { data: matchups } = await supabase
        .from('party_quiplash_matchups')
        .select('*')
        .eq('room_pin', pin)
        .eq('round_index', round)
        .order('sort_order', { ascending: true })
      const step = room.step_index ?? 0
      const m = matchups?.[step]
      if (!m) {
        return NextResponse.json({ error: 'No active matchup' }, { status: 400 })
      }
      if (m.player_a === playerId || m.player_b === playerId) {
        return NextResponse.json({ error: 'Cannot vote on own matchup' }, { status: 400 })
      }
      await supabase.from('party_quiplash_votes').upsert(
        {
          matchup_id: m.id,
          voter_player_id: playerId,
          choice,
        },
        { onConflict: 'matchup_id,voter_player_id' },
      )

      const eligible = playerList.filter((p) => p.player_id !== m.player_a && p.player_id !== m.player_b)
      const { data: votes } = await supabase.from('party_quiplash_votes').select('*').eq('matchup_id', m.id)
      const voted = new Set((votes ?? []).map((v) => v.voter_player_id))
      const allIn = eligible.every((e) => voted.has(e.player_id))

      if (allIn) {
        const vA = (votes ?? []).filter((v) => v.choice === 0).length
        const vB = (votes ?? []).filter((v) => v.choice === 1).length
        const mult = round === 1 ? 1 : 2
        const { ptsA, ptsB } = scoreHeadToHead({
          votesA: vA,
          votesB: vB,
          eligibleVoters: eligible.length,
          roundMultiplier: mult,
        })
        await addScore(pin, m.player_a, ptsA)
        await addScore(pin, m.player_b, ptsB)

        const nextStep = step + 1
        if (nextStep >= (matchups?.length ?? 0)) {
          await bumpRoom(
            pin,
            {
              phase: round === 1 ? 'quiplash_1_scores' : 'quiplash_2_scores',
              step_index: 0,
              deadline_at: null,
            },
            now,
          )
        } else {
          await bumpRoom(
            pin,
            {
              step_index: nextStep,
              deadline_at: new Date(Date.now() + PARTY_VOTE_SECONDS_DEFAULT * 1000).toISOString(),
            },
            now,
          )
        }
      } else {
        await supabase.from('party_rooms').update({ last_activity: now }).eq('pin', pin)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'advanceScoreboard') {
      if (room.host_id !== playerId) {
        return NextResponse.json({ error: 'Host only' }, { status: 403 })
      }
      const phase = room.phase as string
      if (phase === 'quiplash_1_scores') {
        const ids = playerList.map((p) => p.player_id)
        const se = await seedQuiplashRound2(pin, ids, now)
        if (se.error) return NextResponse.json({ error: se.error }, { status: 500 })
        return NextResponse.json({ success: true })
      }
      if (phase === 'quiplash_2_scores') {
        const fp = QUIPLASH_FINAL_PROMPTS[Math.floor(Math.random() * QUIPLASH_FINAL_PROMPTS.length)]!
        await supabase.from('party_quiplash_final_prompt').upsert({
          room_pin: pin,
          prompt_text: fp,
          round_index: 3,
        })
        const deadline = new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString()
        await bumpRoom(pin, { phase: 'quiplash_final_answer', round_index: 3, step_index: 0, deadline_at: deadline }, now)
        return NextResponse.json({ success: true })
      }
      if (phase === 'quiplash_final_scores') {
        await bumpRoom(pin, { phase: 'finished', deadline_at: null }, now)
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: 'Nothing to advance' }, { status: 400 })
    }

    if (action === 'submitFinalAnswer') {
      const { body: text } = body as { body?: string }
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json({ error: 'body required' }, { status: 400 })
      }
      if (room.phase !== 'quiplash_final_answer') {
        return NextResponse.json({ error: 'Not final answer phase' }, { status: 400 })
      }
      const trimmed = text.trim().slice(0, ANSWER_MAX_LEN)
      await supabase.from('party_quiplash_final_answers').upsert(
        {
          room_pin: pin,
          player_id: playerId,
          body: trimmed,
        },
        { onConflict: 'room_pin,player_id' },
      )

      const { data: ans } = await supabase.from('party_quiplash_final_answers').select('player_id').eq('room_pin', pin)
      const have = new Set((ans ?? []).map((a) => a.player_id))
      const allAns = playerList.every((p) => have.has(p.player_id))
      if (allAns) {
        await bumpRoom(
          pin,
          {
            phase: 'quiplash_final_vote',
            deadline_at: new Date(Date.now() + PARTY_VOTE_SECONDS_DEFAULT * 1000).toISOString(),
          },
          now,
        )
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'submitFinalVote') {
      const { slot, targetPlayerId } = body as { slot?: number; targetPlayerId?: string }
      if (slot !== 1 && slot !== 2 && slot !== 3) {
        return NextResponse.json({ error: 'slot 1-3' }, { status: 400 })
      }
      if (!targetPlayerId) {
        return NextResponse.json({ error: 'targetPlayerId required' }, { status: 400 })
      }
      if (room.phase !== 'quiplash_final_vote') {
        return NextResponse.json({ error: 'Not final vote phase' }, { status: 400 })
      }
      await supabase.from('party_quiplash_final_votes').upsert(
        {
          room_pin: pin,
          voter_player_id: playerId,
          slot,
          target_player_id: targetPlayerId,
        },
        { onConflict: 'room_pin,voter_player_id,slot' },
      )

      const { data: fv } = await supabase.from('party_quiplash_final_votes').select('*').eq('room_pin', pin)
      const byVoter = new Map<string, number>()
      for (const v of fv ?? []) {
        byVoter.set(v.voter_player_id, (byVoter.get(v.voter_player_id) ?? 0) + 1)
      }
      const allVoted = playerList.every((p) => (byVoter.get(p.player_id) ?? 0) >= 3)
      if (allVoted) {
        const counts = new Map<string, number>()
        for (const v of fv ?? []) {
          counts.set(v.target_player_id, (counts.get(v.target_player_id) ?? 0) + 1)
        }
        const pts = scoreFinalRound(counts)
        for (const [pid, add] of pts) {
          await addScore(pin, pid, add)
        }
        await bumpRoom(pin, { phase: 'quiplash_final_scores', deadline_at: null }, now)
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
