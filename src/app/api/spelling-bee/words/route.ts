/**
 * Returns the Spelling Bee words found on a board on a day. The daily hive is collaborative: every player on a board
 * shares 1 found list, so a word anyone finds shows for everyone.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validDay } from '@/lib/daily'
import { SCORING_VERSION } from '@/lib/results'
import { supabaseAdmin } from '@/lib/supabase'

const schema = z.object({
  group: z.string().regex(/^[a-z0-9-]{3,32}$/),
  day: z.string().refine(validDay),
})

/**
 * Merges the saved words of every player on the board for the day.
 */
export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { group, day } = body.data
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('words')
    .eq('group_code', group)
    .eq('game', 'bee')
    .eq('day', day)
    .eq('scoring_version', SCORING_VERSION)
  if (error) return NextResponse.json({ error: 'Could not load words' }, { status: 503 })
  const words = [...new Set(data.flatMap((row) => (row.words as string[] | null) ?? []))]
  return NextResponse.json({ words }, { headers: { 'Cache-Control': 'no-store' } })
}
