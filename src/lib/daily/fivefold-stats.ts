/**
 * Computes Wordle stats for this device from the saved per-day runs, merged with the player's synced results.
 */

import { shiftDay, siteDay } from '@/lib/daily'
import { getPlayer, isPracticeResult } from '@/lib/results'

export type FivefoldStats = { played: number; wins: number; cur: number; max: number; dist: number[] }

type Row = { name: string; game: string; day: string; stats: { n?: number; solved?: boolean } }
const RUN_PREFIX = 'fivefold:nyt-v2:'

/**
 * Loads each official finished day as a guess count, with 0 for a loss. Saved runs win over synced rows.
 */
export async function loadFivefoldStats(): Promise<FivefoldStats> {
  const today = siteDay()
  const days = new Map<string, number>()
  const player = getPlayer()
  try {
    if (player) {
      const res = await fetch(`/api/results?group=${encodeURIComponent(player.group)}&days=3000`)
      const { rows } = (await res.json()) as { rows: Row[] }
      for (const r of rows) {
        if (r.game !== 'fivefold' || r.name !== player.name || !r.stats.n) continue
        days.set(r.day, r.stats.solved ? r.stats.n : 0)
      }
    }
  } catch {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? ''
      const [, , day, answer] = k.startsWith(RUN_PREFIX) ? k.split(':') : []
      if (!day || !answer) continue
      const g = (JSON.parse(localStorage.getItem(k) ?? 'null') as { guesses?: string[] } | null)?.guesses
      if (!Array.isArray(g) || !g.length) continue
      const won = g.at(-1) === answer
      if (won || g.length >= 6) days.set(day, won ? g.length : 0)
    }
  } catch {}
  const dist = Array<number>(6).fill(0)
  let played = 0, wins = 0, max = 0, run = 0
  for (const [day, n] of [...days].filter(([d]) => d <= today && !isPracticeResult('fivefold', d)).sort()) {
    played++
    if (n) dist[n - 1]!++
    wins += n ? 1 : 0
    run = n && days.get(shiftDay(day, -1)) ? run + 1 : n ? 1 : 0
    max = Math.max(max, run)
  }
  let cur = 0
  for (let d = days.get(today) ? today : shiftDay(today, -1); days.get(d); d = shiftDay(d, -1)) cur++
  return { played, wins, cur, max, dist }
}
