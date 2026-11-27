/** Loads the exact Headcount party for a Pacific calendar date. */
import first from '../../../data/headcount/2026-11-26.json'
import { headcountEdition } from '@/lib/headcount'
import { supabaseAdmin } from '@/lib/supabase'

/** Checks the party date inside both archived and live responses. */
function partyForDay(value: unknown, day: string) {
  const party = headcountEdition.parse(value)
  if (party.date !== day) throw new Error('No Headcount party published for this date')
  return party
}

/** Preserves the first exact Headcount party captured for a date. */
export async function headcountForDay(day: string) {
  if (day === first.date) return partyForDay(first, day)
  const db = supabaseAdmin.from('daily_game_content')
  const cached = await db.select('payload').eq('game', 'headcount').eq('source_day', day).maybeSingle()
  if (cached.error) throw new Error('Headcount archive unavailable')
  if (cached.data) return partyForDay(cached.data.payload, day)
  const response = await fetch('https://headcountgame.com/api/tonight?d=' + encodeURIComponent(day), {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('Headcount is unavailable')
  const party = partyForDay((await response.json()).party, day)
  const saved = await db.upsert(
    { game: 'headcount', source_day: day, payload: party },
    { onConflict: 'game,source_day', ignoreDuplicates: true },
  )
  if (saved.error) throw new Error('Could not archive this party')
  const stored = await db.select('payload').eq('game', 'headcount').eq('source_day', day).single()
  if (stored.error) throw new Error('Could not read archived party')
  return partyForDay(stored.data.payload, day)
}
