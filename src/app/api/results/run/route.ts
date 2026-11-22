/**
 * Returns the finished game a named player has saved for a day, with its checked moves, so every device under that
 * name opens the day on its result instead of a fresh board.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validDay } from '@/lib/daily'
import { judgeAnswer } from '@/lib/daily/krillion'
import { rateLimited } from '@/lib/api-guards'
import { GAME_IDS, SCORING_VERSION, likeName, type GameId } from '@/lib/results'
import { supabaseAdmin } from '@/lib/supabase'

const schema = z.object({
  group: z.string().regex(/^[a-z0-9-]{3,32}$/),
  name: z.string().trim().min(1).max(24),
  game: z.enum(GAME_IDS as [GameId, ...GameId[]]),
  day: z.string().refine(validDay),
})

/**
 * Looks up the player's first result for the day, matching the name the way /api/results files it. Krillion's saved
 * answers come back judged again, since its result screen shows each round's tier and points.
 */
export async function POST(req: Request) {
  if (rateLimited(req, 'run', 120)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const body = schema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { group, name, game, day } = body.data
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('score,stats,moves')
    .eq('group_code', group)
    .ilike('name', likeName(name.replace(/\s+/g, ' ')))
    .eq('game', game)
    .eq('day', day)
    .eq('scoring_version', SCORING_VERSION)
    .order('created_at')
    .limit(1)
  if (error) return NextResponse.json({ error: 'Could not load the saved game' }, { status: 503 })
  const row = data[0]
  let moves: unknown = row?.moves ?? null
  if (game === 'krillion' && Array.isArray(moves)) {
    try {
      moves = await Promise.all(
        (moves as string[]).map(async (a, i) => {
          const r = a.trim() ? await judgeAnswer(day, i, a) : null
          return r?.accepted ? r : { answer: a, accepted: false, score: 0, reason: 'No accepted answer this round.' }
        }),
      )
    } catch {
      return NextResponse.json({ error: 'Could not load the saved game' }, { status: 503 })
    }
  }
  return NextResponse.json(
    { result: row ? { score: row.score, stats: row.stats, moves } : null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
