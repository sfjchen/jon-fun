import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { PARTY_PHASE_SECONDS_DEFAULT } from './constants'
import { FIBBAGE_BANK } from './prompts-fibbage'

export async function insertFibbageRound(
  pin: string,
  roundIndex: number,
  playerIds: string[],
  nowIso: string,
): Promise<{ error?: string }> {
  const used = (
    await supabase.from('party_fibbage_rounds').select('prompt_template').eq('room_pin', pin)
  ).data?.map((r) => r.prompt_template)
  const pool = FIBBAGE_BANK.filter((p) => !used?.includes(p.template))
  const bank = pool.length > 0 ? pool : FIBBAGE_BANK
  const pick = bank[Math.floor(Math.random() * bank.length)]!
  const picker = playerIds[Math.floor(Math.random() * playerIds.length)]!
  const deadline = new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString()

  const { error } = await supabase.from('party_fibbage_rounds').insert({
    id: uuidv4(),
    room_pin: pin,
    round_index: roundIndex,
    category: pick.category,
    prompt_template: pick.template,
    truth: pick.truth,
    option_order: null,
    picker_player_id: picker,
  })
  if (error) return { error: 'Failed to create fibbage round' }

  const { data: room } = await supabase.from('party_rooms').select('version').eq('pin', pin).single()
  await supabase
    .from('party_rooms')
    .update({
      phase: 'fibbage_lie',
      round_index: roundIndex,
      step_index: 0,
      deadline_at: deadline,
      updated_at: nowIso,
      last_activity: nowIso,
      version: (room?.version ?? 0) + 1,
    })
    .eq('pin', pin)
  return {}
}
