import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { PARTY_PHASE_SECONDS_DEFAULT } from './constants'
import { QUIPLASH_PROMPT_POOL } from './prompts-quiplash'
import { buildQuiplashMatchups } from './quiplash-pairing'

export async function seedQuiplashRound2(pin: string, playerIds: string[], nowIso: string): Promise<{ error?: string }> {
  const shuffled = [...QUIPLASH_PROMPT_POOL].sort(() => Math.random() - 0.5)
  const pairs = buildQuiplashMatchups(playerIds, shuffled, 2)
  const deadline = new Date(Date.now() + PARTY_PHASE_SECONDS_DEFAULT * 1000).toISOString()

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i]!
    const { error } = await supabase.from('party_quiplash_matchups').insert({
      id: uuidv4(),
      room_pin: pin,
      round_index: 2,
      sort_order: i,
      prompt_text: p.promptText,
      player_a: p.a,
      player_b: p.b,
    })
    if (error) return { error: 'Failed to create round 2 matchups' }
  }

  const { data: room } = await supabase.from('party_rooms').select('version').eq('pin', pin).single()
  const { error: upErr } = await supabase
    .from('party_rooms')
    .update({
      phase: 'quiplash_2_answer',
      round_index: 2,
      step_index: 0,
      deadline_at: deadline,
      updated_at: nowIso,
      last_activity: nowIso,
      version: (room?.version ?? 0) + 1,
    })
    .eq('pin', pin)
  if (upErr) return { error: 'Failed to update room' }
  return {}
}
