// Shared types + client-side clock-sync helper for the Jeopardy buzzer.

export type BuzzerStatus = 'idle' | 'armed' | 'locked'

export interface BuzzerSession {
  id: string
  boardId: string
  pin: string
  status: BuzzerStatus
  armedAt: string | null
  lockedAt: string | null
  currentRoundId: string | null
  version: number
  updatedAt: string
}

export interface BuzzerPlayer {
  id: string
  sessionId: string
  playerId: string
  name: string
  color: string
  clockOffsetMs: number
  joinedAt: string
  lastSeenAt: string
}

export interface Buzz {
  id: string
  sessionId?: string
  roundId: string
  playerId: string
  name: string
  color: string
  clientPressAt: string
  serverReceiveAt: string
  effectiveServerPressAt: string
  rank: number | null
  accepted: boolean
  rejectReason: string | null
}

export interface ClockPingResponse {
  t0: number
  tS: number
}

/**
 * Sample server clock with Cristian's algorithm. Returns the offset to add to
 * `Date.now()` on the client to get the equivalent server-side `Date.now()`.
 *
 * Defaults: 7 samples, drop top + bottom by RTT, take median of the rest. Five
 * pings is the minimum that gives stable results; more than ~10 wastes round-trips.
 */
export async function measureClockOffset(
  fetchClockPing: (t0: number) => Promise<ClockPingResponse>,
  samples = 7,
): Promise<{ offsetMs: number; rttMs: number }> {
  const results: Array<{ offset: number; rtt: number }> = []
  for (let i = 0; i < samples; i++) {
    const t0 = Date.now()
    let resp: ClockPingResponse
    try {
      resp = await fetchClockPing(t0)
    } catch {
      continue
    }
    const t1 = Date.now()
    const rtt = t1 - t0
    // Estimate one-way trip = rtt/2; server's `tS` was measured halfway across the wire.
    // offset such that  serverTime ≈ clientTime + offset
    const offset = Math.round(resp.tS - (t0 + rtt / 2))
    results.push({ offset, rtt })
    // Small jitter between pings keeps the server from coalescing them.
    if (i < samples - 1) await new Promise((r) => setTimeout(r, 30))
  }
  if (results.length === 0) return { offsetMs: 0, rttMs: 0 }
  // Drop the worst (highest RTT) sample(s); keep the most precise readings.
  results.sort((a, b) => a.rtt - b.rtt)
  const keep = results.slice(0, Math.max(1, Math.floor(results.length * 0.75)))
  // Median of the kept offsets is robust to a single noisy sample.
  const offsets = keep.map((r) => r.offset).sort((a, b) => a - b)
  const mid = Math.floor(offsets.length / 2)
  const medianOffset = offsets.length % 2 === 0
    ? Math.round(((offsets[mid - 1] ?? 0) + (offsets[mid] ?? 0)) / 2)
    : (offsets[mid] ?? 0)
  const medianRtt = Math.round(keep.reduce((s, r) => s + r.rtt, 0) / keep.length)
  // Clamp huge offsets so a misconfigured device clock can't poison the queue.
  const clamped = Math.max(-30_000, Math.min(30_000, medianOffset))
  return { offsetMs: clamped, rttMs: medianRtt }
}

/** Validate a 4-digit PIN as a string. */
export function isValidBuzzerPin(s: string): boolean {
  return typeof s === 'string' && /^\d{4}$/.test(s)
}

/** PIN allocator (same convention as poker rooms). */
export function generateBuzzerPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export interface BuzzQueueEntry extends Buzz {
  /** Milliseconds behind the #1 buzzer. 0 for the winner. */
  deltaFromFirstMs: number
}

/** Annotate a sorted queue with `deltaFromFirstMs` for UI rendering. */
export function annotateQueue(buzzes: Buzz[]): BuzzQueueEntry[] {
  const accepted = buzzes.filter((b) => b.accepted)
  if (accepted.length === 0) return []
  const first = accepted[0]!
  const firstMs = Date.parse(first.effectiveServerPressAt)
  return accepted.map((b) => {
    const ms = Date.parse(b.effectiveServerPressAt)
    return { ...b, deltaFromFirstMs: ms - firstMs }
  })
}
