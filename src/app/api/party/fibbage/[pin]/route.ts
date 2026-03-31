import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateRoomPin } from '@/lib/poker'
import { ANSWER_MAX_LEN, PARTY_PHASE_SECONDS_DEFAULT } from '@/lib/party/constants'
import { FIBBAGE_SUGGESTED_LIES } from '@/lib/party/prompts-fibbage'
import { insertFibbageRound } from '@/lib/party/fibbage-next-round'

type OptRow = { text: string; truth: boolean; authorId: string | null }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

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
  await supabase.from('party_players').update({ score: (p?.score ?? 0) + delta }).eq('room_pin', pin).eq('player_id', playerId)
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
    if (re || !room || room.game_kind !== 'fibbage') {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const { data: players } = await supabase.from('party_players').select('*').eq('room_pin', pin).order('joined_at', { ascending: true })
    const playerList = players ?? []
    const now = new Date().toISOString()

    const { data: rounds } = await supabase.from('party_fibbage_rounds').select('*').eq('room_pin', pin).order('round_index', { ascending: true })
    const currentRound = rounds?.find((r) => r.round_index === room.round_index) ?? rounds?.[rounds.length - 1]

    if (action === 'submitLie') {
      if (room.phase !== 'fibbage_lie' || !currentRound) {
        return NextResponse.json({ error: 'Not in lie phase' }, { status: 400 })
      }
      const { text, fromSuggestion } = body as { text?: string; fromSuggestion?: boolean }
      let lieText = typeof text === 'string' ? text.trim().slice(0, ANSWER_MAX_LEN) : ''
      const fromSug = Boolean(fromSuggestion)
      if (fromSug) {
        lieText = FIBBAGE_SUGGESTED_LIES[Math.floor(Math.random() * FIBBAGE_SUGGESTED_LIES.length)]!
      }
      if (!lieText) {
        return NextResponse.json({ error: 'Lie text required' }, { status: 400 })
      }
      await supabase.from('party_fibbage_lies').upsert(
        {
          round_id: currentRound.id,
          player_id: playerId,
          lie_text: lieText,
          from_suggestion: fromSug,
        },
        { onConflict: 'round_id,player_id' },
      )

      const { data: lies } = await supabase.from('party_fibbage_lies').select('*').eq('round_id', currentRound.id)
      const have = new Set((lies ?? []).map((l) => l.player_id))
      const allIn = playerList.every((p) => have.has(p.player_id))
      if (allIn) {
        const opts: OptRow[] = [{ text: currentRound.truth, truth: true, authorId: null }]
        for (const row of lies ?? []) {
          opts.push({ text: row.lie_text, truth: false, authorId: row.player_id })
        }
        const shuffled = shuffle(opts)
        await supabase.from('party_fibbage_rounds').update({ option_order: shuffled as unknown as OptRow[] }).eq('id', currentRound.id)
        await bumpRoom(
          pin,
          { phase: 'fibbage_pick', deadline_at: new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString() },
          now,
        )
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'submitPick') {
      if (room.phase !== 'fibbage_pick' || !currentRound) {
        return NextResponse.json({ error: 'Not in pick phase' }, { status: 400 })
      }
      const { pickedIndex } = body as { pickedIndex?: number }
      if (typeof pickedIndex !== 'number' || pickedIndex < 0) {
        return NextResponse.json({ error: 'pickedIndex required' }, { status: 400 })
      }
      const order = (currentRound.option_order as OptRow[] | null) ?? []
      if (pickedIndex >= order.length) {
        return NextResponse.json({ error: 'Invalid index' }, { status: 400 })
      }
      await supabase.from('party_fibbage_picks').upsert(
        { round_id: currentRound.id, player_id: playerId, picked_index: pickedIndex },
        { onConflict: 'round_id,player_id' },
      )

      const { data: picks } = await supabase.from('party_fibbage_picks').select('player_id').eq('round_id', currentRound.id)
      const picked = new Set((picks ?? []).map((p) => p.player_id))
      const allPicked = playerList.every((p) => picked.has(p.player_id))
      if (allPicked) {
        const mult = room.round_index === 1 ? 1 : room.round_index === 2 ? 2 : 3
        const truthIdx = order.findIndex((o) => o.truth)
        const fullPicks = (await supabase.from('party_fibbage_picks').select('*').eq('round_id', currentRound.id)).data ?? []
        const fooledBy = new Map<string, number>()
        for (const pk of fullPicks) {
          if (pk.picked_index === truthIdx) {
            await addScore(pin, pk.player_id, 1000 * mult)
          } else {
            const opt = order[pk.picked_index]
            if (opt && !opt.truth && opt.authorId) {
              fooledBy.set(opt.authorId, (fooledBy.get(opt.authorId) ?? 0) + 1)
            }
          }
        }
        for (const [author, cnt] of fooledBy) {
          const { data: lieRow } = await supabase
            .from('party_fibbage_lies')
            .select('from_suggestion')
            .eq('round_id', currentRound.id)
            .eq('player_id', author)
            .single()
          const half = lieRow?.from_suggestion ? 0.5 : 1
          await addScore(pin, author, Math.floor(500 * mult * half * cnt))
        }

        const { data: likes } = await supabase.from('party_fibbage_likes').select('*').eq('round_id', currentRound.id)
        for (const lk of likes ?? []) {
          await addScore(pin, lk.to_player_id, 5)
        }

        await bumpRoom(pin, { phase: 'fibbage_scores', deadline_at: null }, now)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'submitLike') {
      if (room.phase !== 'fibbage_pick' || !currentRound) {
        return NextResponse.json({ error: 'Not in pick phase' }, { status: 400 })
      }
      const { targetPlayerId } = body as { targetPlayerId?: string }
      if (!targetPlayerId) {
        return NextResponse.json({ error: 'targetPlayerId required' }, { status: 400 })
      }
      await supabase.from('party_fibbage_likes').upsert(
        { round_id: currentRound.id, from_player_id: playerId, to_player_id: targetPlayerId },
        { onConflict: 'round_id,from_player_id,to_player_id' },
      )
      return NextResponse.json({ success: true })
    }

    if (action === 'advance') {
      if (room.host_id !== playerId) {
        return NextResponse.json({ error: 'Host only' }, { status: 403 })
      }
      if (room.phase !== 'fibbage_scores') {
        return NextResponse.json({ error: 'Not at scoreboard' }, { status: 400 })
      }
      const ri = room.round_index ?? 1
      if (ri >= 3) {
        await bumpRoom(pin, { phase: 'finished', deadline_at: null }, now)
        return NextResponse.json({ success: true })
      }
      const ids = playerList.map((p) => p.player_id)
      const se = await insertFibbageRound(pin, ri + 1, ids, now)
      if (se.error) return NextResponse.json({ error: se.error }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
