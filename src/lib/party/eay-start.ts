import { supabaseAdmin as supabase } from '@/lib/supabase'
import { PARTY_PHASE_SECONDS_DEFAULT } from './constants'
import { EAY_INTAKE_QUESTIONS } from './prompts-eay'

export async function seedEayIntake(pin: string, nowIso: string): Promise<{ error?: string }> {
  await supabase.from('party_eay_final_picks').delete().eq('room_pin', pin)
  await supabase.from('party_eay_final').delete().eq('room_pin', pin)
  const eayRounds = (await supabase.from('party_eay_rounds').select('id').eq('room_pin', pin)).data ?? []
  for (const r of eayRounds) {
    await supabase.from('party_eay_likes').delete().eq('round_id', r.id)
    await supabase.from('party_eay_picks').delete().eq('round_id', r.id)
    await supabase.from('party_eay_lies').delete().eq('round_id', r.id)
  }
  await supabase.from('party_eay_rounds').delete().eq('room_pin', pin)
  await supabase.from('party_eay_intake').delete().eq('room_pin', pin)

  const deadline = new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString()
  const { data: room } = await supabase.from('party_rooms').select('version').eq('pin', pin).single()
  const { error: up } = await supabase
    .from('party_rooms')
    .update({
      phase: 'eay_intake',
      round_index: 0,
      step_index: 0,
      deadline_at: deadline,
      settings: { eayQuestionIds: EAY_INTAKE_QUESTIONS.map((q) => q.id) },
      updated_at: nowIso,
      last_activity: nowIso,
      version: (room?.version ?? 0) + 1,
    })
    .eq('pin', pin)
  if (up) return { error: 'Failed to update room' }
  return {}
}
