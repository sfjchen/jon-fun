/**
 * Latency-fair buzzer verification.
 *
 * Hits the deployed API (default https://sfjc.dev) directly using the atomic RPC. Three
 * "players" are simulated with engineered (client_press_at, network_delay) pairs such that
 * the true press order (P1 < P2 < P3) is the REVERSE of network-arrival order — proving
 * that arrival time does NOT determine the winner.
 *
 * Players' clock offsets are written ahead of time via the /join endpoint; the server then
 * trusts those stored offsets when computing effective_server_press_at.
 *
 * Usage: npm run verify:jeopardy-buzzer [-- --slug=<slug>] [-- --base=<url>]
 *   defaults: slug=mendochino-s4yy5, base=https://sfjc.dev
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { v4 as uuidv4 } from 'uuid'

function loadEnv(): void {
  for (const f of ['.env.local', '.env']) {
    const p = join(process.cwd(), f); if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim(); if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('='); if (eq <= 0) continue
      const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!(k in process.env)) process.env[k] = v
    }
  }
}
loadEnv()

const argv = process.argv.slice(2)
function arg(name: string, fallback: string): string {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const SLUG = arg('slug', 'mendochino-s4yy5')
const BASE = arg('base', 'https://sfjc.dev').replace(/\/+$/, '')

let failures = 0
function check(label: string, cond: boolean, detail?: string): void {
  if (cond) console.log(`  PASS  ${label}`)
  else { console.log(`  FAIL  ${label}${detail ? '  ' + detail : ''}`); failures++ }
}

interface SessionDto {
  id: string
  boardId: string
  pin: string
  status: 'idle' | 'armed' | 'locked'
  armedAt: string | null
  lockedAt: string | null
  currentRoundId: string | null
  version: number
  updatedAt: string
}

interface BuzzDto {
  id: string
  roundId: string
  playerId: string
  name: string
  effectiveServerPressAt: string
  rank: number | null
  accepted: boolean
}

async function postSession(): Promise<SessionDto> {
  const res = await fetch(`${BASE}/api/jeopardy/buzzer/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: SLUG }),
  })
  if (!res.ok) throw new Error(`session POST failed: ${res.status} ${await res.text()}`)
  return (await res.json()).session
}

async function patchSession(pin: string, kind: 'arm' | 'clear' | 'lock' | 'unlock'): Promise<SessionDto> {
  const res = await fetch(`${BASE}/api/jeopardy/buzzer/sessions/${pin}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: { kind } }),
  })
  if (!res.ok) throw new Error(`PATCH ${kind} failed: ${res.status} ${await res.text()}`)
  return (await res.json()).session
}

async function joinSession(pin: string, p: { playerId: string; name: string; clockOffsetMs: number }): Promise<void> {
  const res = await fetch(`${BASE}/api/jeopardy/buzzer/sessions/${pin}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...p, color: '#3b82f6' }),
  })
  if (!res.ok) throw new Error(`join failed: ${res.status} ${await res.text()}`)
}

async function buzz(pin: string, p: { playerId: string; name: string; clientPressAt: number; preDelayMs: number; clockOffsetMs: number }): Promise<{ rejected?: boolean; reason?: string; queue?: BuzzDto[] }> {
  if (p.preDelayMs > 0) await new Promise((r) => setTimeout(r, p.preDelayMs))
  const res = await fetch(`${BASE}/api/jeopardy/buzzer/sessions/${pin}/buzz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: p.playerId,
      name: p.name,
      color: '#3b82f6',
      clientPressAt: p.clientPressAt,
      clockOffsetMs: p.clockOffsetMs,
    }),
  })
  if (!res.ok) throw new Error(`buzz failed: ${res.status} ${await res.text()}`)
  return await res.json()
}

async function getQueue(pin: string): Promise<{ session: SessionDto; queue: BuzzDto[] }> {
  const res = await fetch(`${BASE}/api/jeopardy/buzzer/sessions/${pin}`, { cache: 'no-store' as RequestCache })
  if (!res.ok) throw new Error(`GET failed: ${res.status}`)
  return await res.json()
}

async function main() {
  console.log(`Slug: ${SLUG}\nBase: ${BASE}\n`)

  // Create session
  console.log('Creating buzzer session...')
  const session0 = await postSession()
  console.log(`  PIN: ${session0.pin}  status=${session0.status}\n`)

  // Three players with engineered offsets — clocks deliberately different from server.
  // Stored offsets get used by the server, so we can simulate different timings without
  // actually skewing system clocks.
  const players = [
    { playerId: uuidv4(), name: 'P1-FarPress',    clockOffsetMs: 0 },
    { playerId: uuidv4(), name: 'P2-MidPress',    clockOffsetMs: 0 },
    { playerId: uuidv4(), name: 'P3-LatePress',   clockOffsetMs: 0 },
  ]
  for (const p of players) await joinSession(session0.pin, p)

  try {
    // --- Test A: pre-arm buzz is rejected ---
    console.log('[A] pre-arm buzz should be rejected')
    {
      const res = await buzz(session0.pin, {
        playerId: players[0]!.playerId, name: players[0]!.name,
        clientPressAt: Date.now(), preDelayMs: 0, clockOffsetMs: 0,
      })
      check('rejected with reason=round_not_armed', res.rejected === true && res.reason === 'round_not_armed', `got: ${JSON.stringify(res)}`)
    }

    // --- Test B: arm, then 3 buzzes with engineered timestamps ---
    console.log('\n[B] arm + 3 buzzes with reversed arrival order')
    const armed = await patchSession(session0.pin, 'arm')
    check('status now armed', armed.status === 'armed')
    const armedAtMs = armed.armedAt ? Date.parse(armed.armedAt) : 0

    // Engineer: press times in real wall-clock are P1 < P2 < P3 (P1 pressed earliest).
    // But P1 will have the largest network delay before submitting. So the arrival order
    // becomes P3, P2, P1 — yet the server's effective_server_press_at must rank P1 first.
    const t = Date.now()
    const pressTimes = [t + 200, t + 250, t + 300] // P1=200ms ahead of P3
    const preDelays  = [600,    300,    50]        // P1 submits last; P3 submits first

    const results = await Promise.all(players.map((p, i) => buzz(session0.pin, {
      playerId: p.playerId, name: p.name,
      clientPressAt: pressTimes[i]!,
      preDelayMs: preDelays[i]!,
      clockOffsetMs: 0,
    })))

    for (let i = 0; i < players.length; i++) {
      check(`P${i+1} buzz not rejected`, results[i]!.rejected !== true, `got: ${JSON.stringify(results[i])}`)
    }

    const { queue } = await getQueue(session0.pin)
    check('queue has 3 buzzes', queue.length === 3, `got ${queue.length}`)
    const ordered = [...queue].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    check('rank #1 is P1 (earliest press despite latest arrival)', ordered[0]?.playerId === players[0]!.playerId,
      `rank-1 name = "${ordered[0]?.name}"`)
    check('rank #2 is P2', ordered[1]?.playerId === players[1]!.playerId,
      `rank-2 name = "${ordered[1]?.name}"`)
    check('rank #3 is P3', ordered[2]?.playerId === players[2]!.playerId,
      `rank-3 name = "${ordered[2]?.name}"`)
    // Sanity: effective_server_press_at gap between #1 and #2 should reflect the engineered 50ms gap.
    if (ordered[0]?.effectiveServerPressAt && ordered[1]?.effectiveServerPressAt) {
      const dt = Date.parse(ordered[1].effectiveServerPressAt) - Date.parse(ordered[0].effectiveServerPressAt)
      check('P2-P1 gap ~ 50ms (within +/- 5ms)', Math.abs(dt - 50) <= 5, `dt=${dt}ms`)
    }

    // --- Test C: duplicate buzz from same player in same round is idempotent ---
    console.log('\n[C] duplicate buzz is silent no-op')
    const dup = await buzz(session0.pin, {
      playerId: players[0]!.playerId, name: players[0]!.name,
      clientPressAt: pressTimes[0]! + 5_000, preDelayMs: 0, clockOffsetMs: 0,
    })
    check('queue size still 3 after duplicate', Array.isArray(dup.queue) && dup.queue.length === 3,
      `got queue.length = ${dup.queue?.length}`)
    const p1AfterDup = dup.queue?.find((b) => b.playerId === players[0]!.playerId)
    check('P1 still rank #1 (not overwritten by late dup press)',
      p1AfterDup?.rank === 1,
      `rank = ${p1AfterDup?.rank}`)

    // --- Test D: locked → buzz rejected ---
    console.log('\n[D] locked → buzz rejected')
    await patchSession(session0.pin, 'lock')
    // Use a new player so the unique index doesn't make the response idempotent.
    const lateNewPlayer = { playerId: uuidv4(), name: 'D-LateJoiner', clockOffsetMs: 0 }
    await joinSession(session0.pin, lateNewPlayer)
    const lockedRes = await buzz(session0.pin, {
      playerId: lateNewPlayer.playerId, name: lateNewPlayer.name,
      clientPressAt: Date.now(), preDelayMs: 0, clockOffsetMs: 0,
    })
    check('rejected with round_not_armed', lockedRes.rejected === true && lockedRes.reason === 'round_not_armed',
      `got: ${JSON.stringify(lockedRes)}`)

    // --- Test E: re-arm clears the queue (new round_id) ---
    console.log('\n[E] re-arm clears queue (new round_id)')
    const rearmed = await patchSession(session0.pin, 'arm')
    check('new round_id differs from previous', rearmed.currentRoundId !== armed.currentRoundId)
    const { queue: q2 } = await getQueue(session0.pin)
    check('queue empty after re-arm', q2.length === 0, `got ${q2.length}`)
  } finally {
    // Leave session in idle state for tidy follow-up runs.
    try { await patchSession(session0.pin, 'clear') } catch { /* ignore */ }
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} check(s) FAILED`}`)
  if (failures > 0) process.exit(1)
}

main().catch((err) => { console.error(err); process.exit(1) })
