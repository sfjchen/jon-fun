import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { validateRoomPin } from '@/lib/poker'
import { ANSWER_MAX_LEN, PARTY_PHASE_SECONDS_DEFAULT } from '@/lib/party/constants'
import { EAY_INTAKE_QUESTIONS } from '@/lib/party/prompts-eay'
import { FIBBAGE_SUGGESTED_LIES } from '@/lib/party/prompts-fibbage'

type OptRow = { text: string; truth: boolean; authorId: string | null }
type FinalPairSlot = { text: string; isTruth: boolean }

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

async function seedEayRoundsAfterIntake(pin: string, playerList: { player_id: string; name: string }[], nowIso: string) {
  await supabase.from('party_eay_rounds').delete().eq('room_pin', pin)
  let sort = 0
  for (const pl of playerList) {
    const { data: intakes } = await supabase.from('party_eay_intake').select('*').eq('room_pin', pin).eq('player_id', pl.player_id)
    const answers = intakes ?? []
    if (answers.length === 0) continue
    const pick = answers[Math.floor(Math.random() * answers.length)]!
    const qMeta = EAY_INTAKE_QUESTIONS.find((q) => q.id === pick.question_id)
    const template = (qMeta?.template ?? 'Something about {name}').replace('{name}', pl.name)
    await supabase.from('party_eay_rounds').insert({
      id: uuidv4(),
      room_pin: pin,
      round_index: sort + 1,
      subject_player_id: pl.player_id,
      question_id: pick.question_id,
      question_template: template,
      truth: pick.answer,
      option_order: null,
    })
    sort++
  }
  const deadline = new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString()
  const { data: r } = await supabase.from('party_rooms').select('settings,version').eq('pin', pin).single()
  await supabase
    .from('party_rooms')
    .update({
      phase: 'eay_lie',
      round_index: 1,
      step_index: 0,
      deadline_at: deadline,
      updated_at: nowIso,
      last_activity: nowIso,
      version: (r?.version ?? 0) + 1,
    })
    .eq('pin', pin)
}

async function setFinalVotePairForStep(pin: string, playerList: { player_id: string }[], step: number, nowIso: string) {
  const subject = playerList[step]
  if (!subject) return
  const { data: row } = await supabase.from('party_eay_final').select('*').eq('room_pin', pin).eq('player_id', subject.player_id).single()
  if (!row) return
  const pair: FinalPairSlot[] = shuffle([
    { text: row.truth_text, isTruth: true },
    { text: row.lie_text, isTruth: false },
  ])
  const { data: room } = await supabase.from('party_rooms').select('settings,version').eq('pin', pin).single()
  const settings = { ...(room?.settings as Record<string, unknown>), eayFinalPair: pair }
  await supabase
    .from('party_rooms')
    .update({
      step_index: step,
      settings,
      deadline_at: new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString(),
      updated_at: nowIso,
      last_activity: nowIso,
      version: (room?.version ?? 0) + 1,
    })
    .eq('pin', pin)
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
    if (re || !room || room.game_kind !== 'eay') {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const { data: players } = await supabase.from('party_players').select('*').eq('room_pin', pin).order('joined_at', { ascending: true })
    const playerList = players ?? []
    const now = new Date().toISOString()

    const settings = (room.settings as { eayQuestionIds?: string[] }) ?? {}
    const qIds = settings.eayQuestionIds ?? EAY_INTAKE_QUESTIONS.map((q) => q.id)

    const { data: eayRounds } = await supabase.from('party_eay_rounds').select('*').eq('room_pin', pin).order('round_index', { ascending: true })
    const currentEay = eayRounds?.find((r) => r.round_index === room.round_index)

    if (action === 'submitIntake') {
      if (room.phase !== 'eay_intake') {
        return NextResponse.json({ error: 'Not intake phase' }, { status: 400 })
      }
      const { questionId, answer } = body as { questionId?: string; answer?: string }
      if (!questionId || !qIds.includes(questionId)) {
        return NextResponse.json({ error: 'Invalid question' }, { status: 400 })
      }
      const ans = typeof answer === 'string' ? answer.trim().slice(0, ANSWER_MAX_LEN) : ''
      if (!ans) {
        return NextResponse.json({ error: 'Answer required' }, { status: 400 })
      }
      await supabase.from('party_eay_intake').upsert(
        { room_pin: pin, player_id: playerId, question_id: questionId, answer: ans },
        { onConflict: 'room_pin,player_id,question_id' },
      )

      let allDone = true
      for (const p of playerList) {
        const { data: rows } = await supabase.from('party_eay_intake').select('question_id').eq('room_pin', pin).eq('player_id', p.player_id)
        const got = new Set((rows ?? []).map((r) => r.question_id))
        for (const q of qIds) {
          if (!got.has(q)) allDone = false
        }
      }
      if (allDone) {
        await seedEayRoundsAfterIntake(
          pin,
          playerList.map((p) => ({ player_id: p.player_id, name: p.name })),
          now,
        )
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'submitLie') {
      if (room.phase !== 'eay_lie' || !currentEay) {
        return NextResponse.json({ error: 'Not lie phase' }, { status: 400 })
      }
      if (currentEay.subject_player_id === playerId) {
        return NextResponse.json({ error: 'Subject does not submit lie' }, { status: 400 })
      }
      const { text, fromSuggestion } = body as { text?: string; fromSuggestion?: boolean }
      let lieText = typeof text === 'string' ? text.trim().slice(0, ANSWER_MAX_LEN) : ''
      const fromSug = Boolean(fromSuggestion)
      if (fromSug) {
        lieText = FIBBAGE_SUGGESTED_LIES[Math.floor(Math.random() * FIBBAGE_SUGGESTED_LIES.length)]!
      }
      if (!lieText) {
        return NextResponse.json({ error: 'Lie required' }, { status: 400 })
      }
      await supabase.from('party_eay_lies').upsert(
        { round_id: currentEay.id, player_id: playerId, lie_text: lieText, from_suggestion: fromSug },
        { onConflict: 'round_id,player_id' },
      )

      const liarsExpected = playerList.filter((p) => p.player_id !== currentEay.subject_player_id)
      const { data: lies } = await supabase.from('party_eay_lies').select('*').eq('round_id', currentEay.id)
      const have = new Set((lies ?? []).map((l) => l.player_id))
      const allIn = liarsExpected.every((p) => have.has(p.player_id))
      if (allIn) {
        const opts: OptRow[] = [{ text: currentEay.truth, truth: true, authorId: null }]
        for (const row of lies ?? []) {
          opts.push({ text: row.lie_text, truth: false, authorId: row.player_id })
        }
        const shuffled = shuffle(opts)
        await supabase.from('party_eay_rounds').update({ option_order: shuffled as unknown as OptRow[] }).eq('id', currentEay.id)
        await bumpRoom(pin, { phase: 'eay_pick', deadline_at: new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString() }, now)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'submitPick') {
      if (room.phase !== 'eay_pick' || !currentEay) {
        return NextResponse.json({ error: 'Not pick phase' }, { status: 400 })
      }
      if (currentEay.subject_player_id === playerId) {
        return NextResponse.json({ error: 'Subject does not pick' }, { status: 400 })
      }
      const { pickedIndex } = body as { pickedIndex?: number }
      if (typeof pickedIndex !== 'number' || pickedIndex < 0) {
        return NextResponse.json({ error: 'pickedIndex required' }, { status: 400 })
      }
      const order = (currentEay.option_order as OptRow[] | null) ?? []
      if (pickedIndex >= order.length) {
        return NextResponse.json({ error: 'Invalid index' }, { status: 400 })
      }
      await supabase.from('party_eay_picks').upsert(
        { round_id: currentEay.id, player_id: playerId, picked_index: pickedIndex },
        { onConflict: 'round_id,player_id' },
      )

      const pickers = playerList.filter((p) => p.player_id !== currentEay.subject_player_id)
      const { data: picks } = await supabase.from('party_eay_picks').select('player_id').eq('round_id', currentEay.id)
      const picked = new Set((picks ?? []).map((p) => p.player_id))
      const allPicked = pickers.every((p) => picked.has(p.player_id))
      if (allPicked) {
        const mult = room.round_index <= 2 ? room.round_index : 2
        const truthIdx = order.findIndex((o) => o.truth)
        const fullPicks = (await supabase.from('party_eay_picks').select('*').eq('round_id', currentEay.id)).data ?? []
        let repBonus = 0
        for (const pk of fullPicks) {
          if (pk.picked_index === truthIdx) {
            await addScore(pin, pk.player_id, 1000 * mult)
            repBonus++
          } else {
            const opt = order[pk.picked_index]
            if (opt && !opt.truth && opt.authorId) {
              const { data: lr } = await supabase
                .from('party_eay_lies')
                .select('from_suggestion')
                .eq('round_id', currentEay.id)
                .eq('player_id', opt.authorId)
                .single()
              const half = lr?.from_suggestion ? 0.5 : 1
              await addScore(pin, opt.authorId, Math.floor(500 * mult * half))
            }
          }
        }
        await addScore(pin, currentEay.subject_player_id, 1000 * repBonus)

        const { data: likes } = await supabase.from('party_eay_likes').select('*').eq('round_id', currentEay.id)
        for (const lk of likes ?? []) {
          await addScore(pin, lk.to_player_id, 5)
        }

        await bumpRoom(pin, { phase: 'eay_scores', deadline_at: null }, now)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'submitLike') {
      if (room.phase !== 'eay_pick' || !currentEay) {
        return NextResponse.json({ error: 'Not pick phase' }, { status: 400 })
      }
      const { targetPlayerId } = body as { targetPlayerId?: string }
      if (!targetPlayerId) {
        return NextResponse.json({ error: 'targetPlayerId required' }, { status: 400 })
      }
      await supabase.from('party_eay_likes').upsert(
        { round_id: currentEay.id, from_player_id: playerId, to_player_id: targetPlayerId },
        { onConflict: 'round_id,from_player_id,to_player_id' },
      )
      return NextResponse.json({ success: true })
    }

    if (action === 'advance') {
      if (room.host_id !== playerId) {
        return NextResponse.json({ error: 'Host only' }, { status: 403 })
      }
      if (room.phase === 'eay_scores') {
        const maxR = eayRounds?.length ?? 0
        if (room.round_index >= maxR) {
          const { data: r0 } = await supabase.from('party_rooms').select('settings,version').eq('pin', pin).single()
          const nextSettings = { ...(r0?.settings as Record<string, unknown>) }
          delete nextSettings.eayFinalPair
          await supabase
            .from('party_rooms')
            .update({
              phase: 'eay_final_submit',
              round_index: maxR + 1,
              step_index: 0,
              settings: nextSettings,
              deadline_at: new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString(),
              updated_at: now,
              last_activity: now,
              version: (r0?.version ?? 0) + 1,
            })
            .eq('pin', pin)
          return NextResponse.json({ success: true })
        }
        const deadline = new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString()
        await bumpRoom(pin, { phase: 'eay_lie', round_index: (room.round_index ?? 1) + 1, step_index: 0, deadline_at: deadline }, now)
        return NextResponse.json({ success: true })
      }
      if (room.phase === 'eay_final_scores') {
        await bumpRoom(pin, { phase: 'finished', deadline_at: null }, now)
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: 'Nothing to advance' }, { status: 400 })
    }

    if (action === 'submitFinal') {
      if (room.phase !== 'eay_final_submit') {
        return NextResponse.json({ error: 'Not final submit phase' }, { status: 400 })
      }
      const { truthText, lieText } = body as { truthText?: string; lieText?: string }
      const t = typeof truthText === 'string' ? truthText.trim().slice(0, ANSWER_MAX_LEN) : ''
      const l = typeof lieText === 'string' ? lieText.trim().slice(0, ANSWER_MAX_LEN) : ''
      if (!t || !l) {
        return NextResponse.json({ error: 'truth and lie required' }, { status: 400 })
      }
      await supabase.from('party_eay_final').upsert(
        { room_pin: pin, player_id: playerId, truth_text: t, lie_text: l },
        { onConflict: 'room_pin,player_id' },
      )
      const { data: finals } = await supabase.from('party_eay_final').select('player_id').eq('room_pin', pin)
      const have = new Set((finals ?? []).map((f) => f.player_id))
      const allIn = playerList.every((p) => have.has(p.player_id))
      if (allIn) {
        const { data: r0 } = await supabase.from('party_rooms').select('settings,version').eq('pin', pin).single()
        await supabase
          .from('party_rooms')
          .update({
            phase: 'eay_final_vote',
            step_index: 0,
            updated_at: now,
            last_activity: now,
            version: (r0?.version ?? 0) + 1,
          })
          .eq('pin', pin)
        await setFinalVotePairForStep(pin, playerList, 0, now)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'submitFinalPick') {
      if (room.phase !== 'eay_final_vote') {
        return NextResponse.json({ error: 'Not final vote' }, { status: 400 })
      }
      const { choiceIndex } = body as { choiceIndex?: number }
      if (choiceIndex !== 0 && choiceIndex !== 1) {
        return NextResponse.json({ error: 'choiceIndex 0 or 1' }, { status: 400 })
      }
      const step = room.step_index ?? 0
      const subject = playerList[step]
      if (!subject) {
        return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
      }
      if (subject.player_id === playerId) {
        return NextResponse.json({ error: 'Cannot vote on self' }, { status: 400 })
      }
      const pair = (room.settings as { eayFinalPair?: FinalPairSlot[] })?.eayFinalPair ?? []
      if (pair.length !== 2) {
        return NextResponse.json({ error: 'Missing display pair' }, { status: 400 })
      }
      await supabase.from('party_eay_final_picks').upsert(
        {
          room_pin: pin,
          voter_player_id: playerId,
          subject_player_id: subject.player_id,
          choice_index: choiceIndex,
        },
        { onConflict: 'room_pin,voter_player_id,subject_player_id' },
      )

      const voters = playerList.filter((p) => p.player_id !== subject.player_id)
      const { data: fpicks } = await supabase
        .from('party_eay_final_picks')
        .select('voter_player_id')
        .eq('room_pin', pin)
        .eq('subject_player_id', subject.player_id)
      const voted = new Set((fpicks ?? []).map((f) => f.voter_player_id))
      const allVoted = voters.every((v) => voted.has(v.player_id))
      if (allVoted) {
        const correctIdx = pair.findIndex((p) => p.isTruth)
        const full = (await supabase.from('party_eay_final_picks').select('*').eq('room_pin', pin).eq('subject_player_id', subject.player_id))
          .data ?? []
        for (const pk of full) {
          if (pk.choice_index === correctIdx) {
            await addScore(pin, pk.voter_player_id, 500)
          } else {
            await addScore(pin, subject.player_id, 250)
          }
        }
        const nextStep = step + 1
        if (nextStep >= playerList.length) {
          await bumpRoom(pin, { phase: 'eay_final_scores', deadline_at: null }, now)
        } else {
          await setFinalVotePairForStep(pin, playerList, nextStep, now)
        }
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
