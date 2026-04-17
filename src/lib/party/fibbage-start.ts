import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { PARTY_PHASE_SECONDS_DEFAULT } from './constants'
import { FIBBAGE_BANK } from './prompts-fibbage'

export async function seedFibbageGame(pin: string, playerIds: string[], nowIso: string): Promise<{ error?: string }> {
  const fibRounds = (await supabase.from('party_fibbage_rounds').select('id').eq('room_pin', pin)).data ?? []
  for (const r of fibRounds) {
    await supabase.from('party_fibbage_likes').delete().eq('round_id', r.id)
    await supabase.from('party_fibbage_picks').delete().eq('round_id', r.id)
    await supabase.from('party_fibbage_lies').delete().eq('round_id', r.id)
  }
  await supabase.from('party_fibbage_rounds').delete().eq('room_pin', pin)

  const pick = FIBBAGE_BANK[Math.floor(Math.random() * FIBBAGE_BANK.length)]!
  const picker = playerIds[Math.floor(Math.random() * playerIds.length)]!
  const deadline = new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString()
  const roundId = uuidv4()

  const { error: ins } = await supabase.from('party_fibbage_rounds').insert({
    id: roundId,
    room_pin: pin,
    round_index: 1,
    category: pick.category,
    prompt_template: pick.template,
    truth: pick.truth,
    option_order: null,
    picker_player_id: picker,
  })
  if (ins) return { error: 'Failed to start fibbage round' }

  const { data: room } = await supabase.from('party_rooms').select('version').eq('pin', pin).single()
  const { error: up } = await supabase
    .from('party_rooms')
    .update({
      phase: 'fibbage_lie',
      round_index: 1,
      step_index: 0,
      deadline_at: deadline,
      updated_at: nowIso,
      last_activity: nowIso,
      version: (room?.version ?? 0) + 1,
    })
    .eq('pin', pin)
  if (up) return { error: 'Failed to update room' }
  return {}
}
