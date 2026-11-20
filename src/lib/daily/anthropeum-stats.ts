import { z } from 'zod'

const count = z.number().int().nonnegative()
export const ANTHROPEUM_BUCKET_SIZE = 2000
export const anthropeumDistributionSchema = z.object({
  buckets: z.array(count).length(50),
  totalPlayers: count,
  roundSums: z.record(z.string().regex(/^\d+$/), count),
  roundPlayers: count,
}).refine(d => d.buckets.reduce((sum, n) => sum + n, 0) === d.totalPlayers &&
  d.roundPlayers <= d.totalPlayers &&
  Object.values(d.roundSums).every(sum => sum <= d.roundPlayers * 10000))
export type AnthropeumDistribution = z.infer<typeof anthropeumDistributionSchema>

export function anthropeumPlacement(distribution: AnthropeumDistribution, score: number) {
  const { buckets, totalPlayers } = distribution
  if (!totalPlayers) return null
  const bucket = Math.min(buckets.length - 1, Math.max(0, Math.floor(score / ANTHROPEUM_BUCKET_SIZE)))
  const below = buckets.slice(0, bucket).reduce((sum, n) => sum + n, 0)
  const percentile = 100 * (below + buckets[bucket]! / 2) / totalPlayers
  const mean = buckets.reduce((sum, n, i) => sum + n * (i + 0.5) * ANTHROPEUM_BUCKET_SIZE, 0) / totalPlayers
  return { bucket, top: Math.max(1, Math.round(100 - percentile)), mean: Math.round(mean) }
}
