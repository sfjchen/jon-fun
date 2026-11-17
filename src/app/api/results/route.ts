import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GAMES, GAME_IDS, type GameId } from '@/lib/results'
import { DAILY_EPOCH, siteDay, validDay } from '@/lib/daily'
import { supabaseAdmin } from '@/lib/supabase'
const group = z.string().regex(/^[a-z0-9-]{3,32}$/)
const stats = z.object({
  n: z.number().int().min(0).max(500).optional(), seconds: z.number().int().min(0).max(864000).optional(),
  mistakes: z.number().int().min(0).max(100).optional(), solved: z.boolean().optional(),
  max: z.number().int().min(1).max(100000).optional(), sourceDate: z.string().refine(validDay).optional(),
  puzzleId: z.string().max(100).optional(),
})
const postSchema = z.object({ group, name: z.string().trim().min(1).max(24), today: z.string().refine(validDay),
  game: z.enum(GAME_IDS as [GameId, ...GameId[]]), score: z.number().int().min(0),
  n: z.number().int().min(0).max(500).optional(), stats: stats.optional() })
export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid result' }, { status: 400 })
  const b = parsed.data
  if (b.score > GAMES[b.game].max || b.today < DAILY_EPOCH || b.today > siteDay()) return NextResponse.json({ error: 'Score or date out of range' }, { status: 400 })
  const key = { group_code: b.group, name: b.name, game: b.game, day: b.today }
  const value = { ...key, score: b.score, stats: { ...b.stats, ...(b.n === undefined ? {} : { n: b.n }) } }
  const inserted = await supabaseAdmin.from('game_results').insert(value)
  if (inserted.error && inserted.error.code !== '23505') return NextResponse.json({ error: 'Could not save score. It remains queued on your device.' }, { status: 503 })
  if (inserted.error?.code === '23505') {
    // Conditional update is atomic: a slower request can never overwrite a better score.
    const updated = await supabaseAdmin.from('game_results').update({ score: value.score, stats: value.stats }).match(key).lt('score', value.score)
    if (updated.error) return NextResponse.json({ error: 'Could not sync score' }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const g = group.safeParse(q.get('group'))
  if (!g.success) return NextResponse.json({ error: 'Invalid group' }, { status: 400 })
  const days = Math.min(4000, Math.max(1, Number(q.get('days')) || 400))
  const since = new Date(Date.now() - (days + 1) * 86400000).toISOString().slice(0, 10)
  // PostgREST's default 1,000-row page would silently truncate busy groups.
  const rows: unknown[] = []
  for (let offset = 0; offset < 100000; offset += 1000) {
    const { data, error } = await supabaseAdmin.from('game_results').select('name, game, day, score, stats')
      .eq('group_code', g.data).in('game', GAME_IDS).gte('day', since).order('day', { ascending: false }).order('game').order('name').range(offset, offset + 999)
    if (error) return NextResponse.json({ error: 'Could not load scores' }, { status: 503 })
    rows.push(...data ?? [])
    if (!data || data.length < 1000) break
  }
  return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } })
}
