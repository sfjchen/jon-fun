/**
 * Returns Multiplayer leaderboard rows per player for one game (24 or SET) over the last N days or all time.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export type MatchRow = {
  name: string
  played: number
  wins: number
  winRate: number
  bestMs: number | null
  avgMs: number | null
  sets: number
}

/**
 * Aggregates match rows by player name for the requested game and window.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const game = q.get('game') === 'set' ? 'set' : '24'
  const days = Number(q.get('days'))
  let query = supabaseAdmin
    .from('match_results')
    .select('player_name, won, solve_ms_best, solve_ms_avg, sets_found')
    .eq('game', game)
  if (days > 0) query = query.gte('played_at', new Date(Date.now() - days * 86400000).toISOString())
  const { data, error } = await query.limit(10000)
  if (error) return NextResponse.json({ error: 'Could not load results' }, { status: 503 })
  const by = new Map<string, { played: number; wins: number; best: number[]; avg: number[]; sets: number }>()
  for (const r of data ?? []) {
    const a = by.get(r.player_name) ?? { played: 0, wins: 0, best: [], avg: [], sets: 0 }
    a.played++
    a.wins += r.won ? 1 : 0
    a.sets += r.sets_found ?? 0
    if (r.solve_ms_best != null) a.best.push(r.solve_ms_best)
    if (r.solve_ms_avg != null) a.avg.push(r.solve_ms_avg)
    by.set(r.player_name, a)
  }
  const rows: MatchRow[] = [...by].map(([name, a]) => ({
    name,
    played: a.played,
    wins: a.wins,
    winRate: a.wins / a.played,
    bestMs: a.best.length ? Math.min(...a.best) : null,
    avgMs: a.avg.length ? Math.round(a.avg.reduce((x, y) => x + y, 0) / a.avg.length) : null,
    sets: a.sets,
  }))
  rows.sort((x, y) => y.wins - x.wins || y.winRate - x.winRate)
  return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } })
}
