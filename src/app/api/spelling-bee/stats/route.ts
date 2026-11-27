/**
 * Returns how many named players on a board have scored on a day's Spelling Bee and how many reached Genius.
 * Counts leaderboard rows, so a browser without a name (a test run, a private window) is not a player.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validDay } from '@/lib/daily'
import { GUEST } from '@/lib/results'
import { supabaseAdmin } from '@/lib/supabase'

const schema = z.object({ group: z.string().regex(/^[a-z0-9-]{3,32}$/), day: z.string().refine(validDay) })

/**
 * Counts the board's Bee results for the day, returning { players, genius }.
 */
export async function GET(req: Request) {
  const q = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!q.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('score,stats')
    .eq('group_code', q.data.group)
    .eq('game', 'bee')
    .eq('day', q.data.day)
    .neq('name', GUEST)
  if (error) return NextResponse.json({ error: 'Could not load players' }, { status: 503 })
  const genius = data.filter(
    (r) => r.score >= Math.round(0.7 * ((r.stats as { max?: number } | null)?.max ?? Infinity)),
  )
  return NextResponse.json(
    { players: data.length, genius: genius.length },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
