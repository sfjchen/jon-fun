/**
 * Returns the Spelling Bee words a named player has found on a day, so every device under that name shares 1
 * found list.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validDay } from '@/lib/daily'
import { SCORING_VERSION, likeName } from '@/lib/results'
import { supabaseAdmin } from '@/lib/supabase'

const schema = z.object({
  group: z.string().regex(/^[a-z0-9-]{3,32}$/),
  name: z.string().trim().min(1).max(24),
  day: z.string().refine(validDay),
})

/**
 * Looks up the player's saved words for the day, matching the name the way /api/results files it.
 */
export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { group, name, day } = body.data
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('words')
    .eq('group_code', group)
    .ilike('name', likeName(name))
    .eq('game', 'bee')
    .eq('day', day)
    .eq('scoring_version', SCORING_VERSION)
    .order('created_at')
    .limit(1)
  if (error) return NextResponse.json({ error: 'Could not load words' }, { status: 503 })
  return NextResponse.json({ words: data[0]?.words ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}
