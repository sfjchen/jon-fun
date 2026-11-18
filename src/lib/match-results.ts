/**
 * Server-side writes for the Multiplayer leaderboard: records one row per player when a 24 or SET room finishes.
 */

import { supabaseAdmin } from '@/lib/supabase'

export type MatchPlayer = {
  id: string
  name: string
  score: number
  best?: number | null
  avg?: number | null
  sets?: number
  misses?: number
}

/**
 * Ranks players by score (ties share a rank, all top scorers win) and inserts the rows, ignoring duplicates.
 */
export async function recordMatch(game: '24' | 'set', pin: string, startedAt: string, players: MatchPlayer[]) {
  if (players.length < 2) return
  const rows = players.map((p) => {
    const rank = 1 + players.filter((o) => o.score > p.score).length
    return {
      game,
      room_pin: pin,
      room_started_at: startedAt,
      player_id: p.id,
      player_name: p.name,
      won: rank === 1,
      rank,
      score: p.score,
      solve_ms_best: p.best ?? null,
      solve_ms_avg: p.avg ?? null,
      sets_found: p.sets ?? null,
      misses: p.misses ?? null,
    }
  })
  await supabaseAdmin
    .from('match_results')
    .upsert(rows, { onConflict: 'game,room_pin,room_started_at,player_id', ignoreDuplicates: true })
}
