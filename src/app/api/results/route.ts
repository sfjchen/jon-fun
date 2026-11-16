/**
 * Stores and lists daily game results for the Scores hub. A result belongs to a (group code, name) pair,
 * so friends who type the same group code see each other. Pasted share text is parsed and bounded here.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GAMES, GAME_IDS, parseShare, type GameId, type Result } from '@/lib/results'
import { supabaseAdmin } from '@/lib/supabase'

const group = z.string().regex(/^[a-z0-9-]{3,32}$/)
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const postSchema = z.object({
  group,
  name: z.string().trim().min(1).max(24),
  today: day,
  text: z.string().max(800).optional(),
  game: z.enum(GAME_IDS as [GameId, ...GameId[]]).optional(),
  score: z.number().int().optional(),
  n: z.number().int().min(0).max(500).optional(),
  secs: z.number().int().min(1).max(10800).optional(),
})

/**
 * Reports whether a day is within 2 days of the server's date, which covers every time zone and
 * puzzles released the evening before.
 */
function recent(d: string): boolean {
  return Math.abs(Date.parse(`${d}T12:00:00Z`) - Date.now()) < 2.5 * 86400000
}

/**
 * Records one result. Official games keep the first result of the day, own games keep the best.
 * Time since the game was opened is kept for official games that do not report a time themselves.
 */
export async function POST(req: Request) {
  const body = postSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const b = body.data
  const res: Result | null = b.text
    ? parseShare(b.text, b.today)
    : b.game && b.score !== undefined
      ? { game: b.game, day: b.today, score: b.score, detail: '', stats: b.n === undefined ? {} : { n: b.n } }
      : null
  if (!res) return NextResponse.json({ error: 'No game result found in that text' }, { status: 400 })
  const def = GAMES[res.game]
  if (res.score < 0 || res.score > def.max || !recent(res.day)) {
    return NextResponse.json({ error: 'That result is out of range or too old' }, { status: 400 })
  }
  if (b.secs && def.official && !def.time) res.stats.secs = b.secs
  const key = { group_code: b.group, name: b.name, game: res.game, day: res.day }
  const { data: old } = await supabaseAdmin.from('game_results').select('score, detail, stats').match(key).maybeSingle()
  if (old && !(def.best && res.score > old.score)) {
    return NextResponse.json({ result: { ...res, score: old.score, detail: old.detail, stats: old.stats }, kept: true })
  }
  const { error } = await supabaseAdmin
    .from('game_results')
    .upsert({ ...key, score: res.score, detail: res.detail, stats: res.stats })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ result: res })
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
    .select('name, game, day, score, detail, stats')
    .eq('group_code', g.data)
    .gte('day', since)
    .order('day', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data })
}
