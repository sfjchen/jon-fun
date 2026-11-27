import first from '../../../data/headcount/2026-11-26.json'
import { headcountEdition } from '@/lib/headcount'
import { supabaseAdmin } from '@/lib/supabase'

export async function headcountForDay(day: string) {
  if (day === first.date) return headcountEdition.parse(first)
  const db = supabaseAdmin.from('daily_game_content')
  const cached = await db.select('payload').eq('game', 'headcount').eq('source_day', day).maybeSingle()
  if (cached.error) throw new Error('Headcount archive unavailable')
  if (cached.data) return headcountEdition.parse(cached.data.payload)
  const response = await fetch('https://headcountgame.com/api/tonight?d=' + encodeURIComponent(day), {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('Headcount is unavailable')
  const party = headcountEdition.parse((await response.json()).party)
  if (party.date !== day) throw new Error('No Headcount party published for this date')
  const saved = await db.upsert(
    { game: 'headcount', source_day: day, payload: party },
    { onConflict: 'game,source_day', ignoreDuplicates: true },
  )
  if (saved.error) throw new Error('Could not archive this party')
  const stored = await db.select('payload').eq('game', 'headcount').eq('source_day', day).single()
  if (stored.error) throw new Error('Could not read archived party')
  return headcountEdition.parse(stored.data.payload)
}
