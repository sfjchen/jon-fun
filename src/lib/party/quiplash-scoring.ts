import { QUIPLASH_FINAL_POOL, QUIPLASH_MATCHUP_POOL_R1 } from './constants'

/** Returns points to add for playerA and playerB for this matchup. */
export function scoreHeadToHead(params: {
  votesA: number
  votesB: number
  eligibleVoters: number
  roundMultiplier: number
}): { ptsA: number; ptsB: number } {
  const { votesA, votesB, eligibleVoters, roundMultiplier } = params
  const pool = QUIPLASH_MATCHUP_POOL_R1 * roundMultiplier

  if (eligibleVoters <= 0) {
    return { ptsA: Math.floor(pool / 2), ptsB: Math.floor(pool / 2) }
  }

  const sweepA = votesA === eligibleVoters && votesA > 0
  const sweepB = votesB === eligibleVoters && votesB > 0
  if (sweepA) {
    return { ptsA: Math.floor(pool * 1.25), ptsB: 0 }
  }
  if (sweepB) {
    return { ptsA: 0, ptsB: Math.floor(pool * 1.25) }
  }

  if (votesA === votesB) {
    const half = Math.floor(pool / 2)
    return { ptsA: half, ptsB: pool - half }
  }

  const winnerBonus = Math.floor(pool * 0.1)
  if (votesA > votesB) {
    const winnerGets = Math.floor(pool * 0.55) + winnerBonus
    return { ptsA: winnerGets, ptsB: pool - winnerGets }
  }
  const winnerGets = Math.floor(pool * 0.55) + winnerBonus
  return { ptsA: pool - winnerGets, ptsB: winnerGets }
}

/** Distribute QUIPLASH_FINAL_POOL by vote counts (each vote slot counts once). */
export function scoreFinalRound(voteCounts: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  let total = 0
  for (const c of voteCounts.values()) total += c
  if (total <= 0) {
    const ids = [...voteCounts.keys()]
    const each = ids.length ? Math.floor(QUIPLASH_FINAL_POOL / ids.length) : 0
    for (const id of ids) out.set(id, each)
    return out
  }
  let allocated = 0
  const entries = [...voteCounts.entries()].sort((a, b) => b[1] - a[1])
  for (let i = 0; i < entries.length; i++) {
    const [pid, cnt] = entries[i]!
    const isLast = i === entries.length - 1
    const share = isLast ? QUIPLASH_FINAL_POOL - allocated : Math.floor((QUIPLASH_FINAL_POOL * cnt) / total)
    allocated += share
    out.set(pid, share)
  }
  return out
}
