/**
 * Stores and lists daily game results for the Scores hub. A result belongs to a (group code, name) pair,
 * so friends who type the same group code see each other. Only the site's own games report here.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GAMES, GAME_IDS, type GameId } from '@/lib/results'
import { supabaseAdmin } from '@/lib/supabase'

const group = z.string().regex(/^[a-z0-9-]{3,32}$/)

const postSchema = z.object({
  group,
  name: z.string().trim().min(1).max(24),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  game: z.enum(GAME_IDS as [GameId, ...GameId[]]),
  score: z.number().int().min(0),
  n: z.number().int().min(0).max(500).optional(),
})

/**
 * Records a player's score for the day, keeping the best one. The day must be within 2 days of the
 * server's date, which covers every time zone.
 */
export async function POST(req: Request) {
  const body = postSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const b = body.data
  if (b.score > GAMES[b.game].max || Math.abs(Date.parse(`${b.today}T12:00:00Z`) - Date.now()) > 2.5 * 86400000) {
    return NextResponse.json({ error: 'That result is out of range or too old' }, { status: 400 })
  }
  const key = { group_code: b.group, name: b.name, game: b.game, day: b.today }
  const { data: old } = await supabaseAdmin.from('game_results').select('score').match(key).maybeSingle()
  if (old && old.score >= b.score) return NextResponse.json({ kept: true })
  const { error } = await supabaseAdmin
    .from('game_results')
    .upsert({ ...key, score: b.score, stats: b.n === undefined ? {} : { n: b.n } })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/**
 * Lists a group's results from the last `days` days (default 7, at most 400).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const g = group.safeParse(q.get('group'))
  if (!g.success) return NextResponse.json({ error: 'Invalid group' }, { status: 400 })
  const days = Math.min(400, Math.max(1, Number(q.get('days')) || 7))
  const since = new Date(Date.now() - (days + 1) * 86400000).toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('name, game, day, score, stats')
    .eq('group_code', g.data)
    .in('game', GAME_IDS)
    .gte('day', since)
    .order('day', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data })
}
