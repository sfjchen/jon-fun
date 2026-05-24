/**
 * Multi-client realtime + CAS smoke test for the Jeopardy lobby.
 *
 * Opens TWO Supabase realtime subscribers (simulating two browser tabs/devices)
 * on the same board row, then performs writes against the deployed Vercel API
 * (default https://sfjc.dev) and asserts both subscribers see the change.
 *
 * Tests:
 *  1. Board content edit fan-out (PATCH /api/jeopardy/boards/[slug])
 *  2. Play-state edit fan-out (PATCH /api/jeopardy/boards/[slug]/play-state)
 *  3. Concurrent CAS race (two PATCHes fired in parallel both end up applied)
 *
 * Usage: npm run verify:jeopardy-realtime [-- --slug=<slug>] [-- --base=<url>]
 *   defaults: slug=mendochino-s4yy5, base=https://sfjc.dev
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

function loadEnvLocal(): void {
  for (const f of ['.env.local', '.env']) {
    const p = join(process.cwd(), f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim(); if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('='); if (eq <= 0) continue
      const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!(k in process.env)) process.env[k] = v
    }
  }
}
loadEnvLocal()

const argv = process.argv.slice(2)
function getArg(name: string, fallback: string): string {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const SLUG = getArg('slug', 'mendochino-s4yy5')
const BASE = getArg('base', 'https://sfjc.dev').replace(/\/+$/, '')

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!URL || !ANON) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')

interface Subscriber {
  name: string
  events: Array<{ version: number; playVersion: number; board: Record<string, unknown>; playState: Record<string, unknown> }>
  channel: RealtimeChannel
  cleanup: () => Promise<void>
}

async function makeSubscriber(name: string): Promise<Subscriber> {
  const client = createClient(URL!, ANON!, { realtime: { params: { eventsPerSecond: 20 } } })
  const events: Subscriber['events'] = []
  const ch = client
    .channel(`verify:${name}:${SLUG}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'jeopardy_boards', filter: `slug=eq.${SLUG}` },
      (payload) => {
        const row = (payload.new ?? {}) as Record<string, unknown>
        events.push({
          version: typeof row.version === 'number' ? row.version : 0,
          playVersion: typeof row.play_version === 'number' ? row.play_version : 0,
          board: (row.board ?? {}) as Record<string, unknown>,
          playState: (row.play_state ?? {}) as Record<string, unknown>,
        })
      },
    )
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Subscriber ${name} timed out subscribing`)), 10_000)
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); resolve() }
      else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') { clearTimeout(t); reject(new Error(`Subscriber ${name}: ${status}`)) }
    })
  })
  return {
    name,
    events,
    channel: ch,
    cleanup: async () => { await ch.unsubscribe().catch(() => {}); await client.removeAllChannels().catch(() => {}) },
  }
}

function waitFor<T>(check: () => T | null, label: string, timeoutMs = 8000, intervalMs = 50): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      const v = check()
      if (v !== null && v !== undefined) return resolve(v)
      if (Date.now() - start > timeoutMs) return reject(new Error(`timeout: ${label}`))
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}

async function patchContent(op: Record<string, unknown>): Promise<{ version: number; board: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/api/jeopardy/boards/${SLUG}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, editorName: 'verifier' }),
  })
  if (!res.ok) throw new Error(`content PATCH failed: ${res.status} ${await res.text().catch(() => '')}`)
  return await res.json()
}

async function patchPlay(op: Record<string, unknown>): Promise<{ playVersion: number; playState: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/api/jeopardy/boards/${SLUG}/play-state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op }),
  })
  if (!res.ok) throw new Error(`play PATCH failed: ${res.status} ${await res.text().catch(() => '')}`)
  return await res.json()
}

async function getBoard(): Promise<{ version: number; playVersion: number; board: Record<string, unknown>; playState: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/api/jeopardy/boards/${SLUG}`, { cache: 'no-store' as RequestCache })
  if (!res.ok) throw new Error(`GET failed: ${res.status}`)
  return await res.json()
}

let failures = 0
function check(label: string, cond: boolean, detail?: string): void {
  if (cond) console.log(`  ✓ ${label}`)
  else { console.log(`  ✗ ${label}${detail ? '  ' + detail : ''}`); failures++ }
}

async function main() {
  console.log(`Slug: ${SLUG}`)
  console.log(`Base: ${BASE}`)
  console.log('Opening two realtime subscribers...')
  const a = await makeSubscriber('A')
  const b = await makeSubscriber('B')
  console.log('  both SUBSCRIBED')

  const baseline = await getBoard()
  console.log(`Baseline: version=${baseline.version}  playVersion=${baseline.playVersion}`)

  try {
    // ---- Test 1: board content edit fan-out ----
    console.log('\n[Test 1] board content fan-out (setCategoryTitle col=0)')
    const tag = `realtime-test-${Date.now().toString(36)}`
    const before = (baseline.board as { categories?: Array<{ title?: string }> }).categories?.[0]?.title ?? ''
    const patched = await patchContent({ kind: 'setCategoryTitle', col: 0, title: tag })
    check('PATCH returned bumped version', patched.version === baseline.version + 1, `expected ${baseline.version + 1}, got ${patched.version}`)
    check('PATCH server state shows new title',
      ((patched.board as { categories?: Array<{ title?: string }> }).categories?.[0]?.title ?? '') === tag)

    // Wait for both subscribers to see the new version.
    const evA = await waitFor(() => a.events.find((e) => e.version >= patched.version) ?? null, 'A receives content fan-out')
    const evB = await waitFor(() => b.events.find((e) => e.version >= patched.version) ?? null, 'B receives content fan-out')
    check('A subscriber received event', evA.version >= patched.version)
    check('B subscriber received event', evB.version >= patched.version)
    check('A payload contains new title',
      ((evA.board as { categories?: Array<{ title?: string }> }).categories?.[0]?.title ?? '') === tag)
    check('B payload contains new title',
      ((evB.board as { categories?: Array<{ title?: string }> }).categories?.[0]?.title ?? '') === tag)

    // Restore original title.
    await patchContent({ kind: 'setCategoryTitle', col: 0, title: before })

    // ---- Test 2: play-state edit fan-out ----
    console.log('\n[Test 2] play-state fan-out (setTeamName, adjustTeamScore)')
    const baseline2 = await getBoard()
    const nameTag = `Team-RT-${Date.now().toString(36)}`
    const aEvCountBefore = a.events.length
    const bEvCountBefore = b.events.length

    const p1 = await patchPlay({ kind: 'setTeamName', index: 0, name: nameTag })
    check('play PATCH bumped playVersion', p1.playVersion === baseline2.playVersion + 1)
    check('play PATCH state has new name',
      ((p1.playState as { teams?: Array<{ name?: string }> }).teams?.[0]?.name ?? '') === nameTag)

    const aP1 = await waitFor(
      () => a.events.slice(aEvCountBefore).find((e) => e.playVersion >= p1.playVersion) ?? null,
      'A receives play-state fan-out',
    )
    const bP1 = await waitFor(
      () => b.events.slice(bEvCountBefore).find((e) => e.playVersion >= p1.playVersion) ?? null,
      'B receives play-state fan-out',
    )
    check('A payload contains new team name',
      ((aP1.playState as { teams?: Array<{ name?: string }> }).teams?.[0]?.name ?? '') === nameTag)
    check('B payload contains new team name',
      ((bP1.playState as { teams?: Array<{ name?: string }> }).teams?.[0]?.name ?? '') === nameTag)

    // Score adjustment
    const aEvCountB2 = a.events.length
    const bEvCountB2 = b.events.length
    const p2 = await patchPlay({ kind: 'adjustTeamScore', index: 0, delta: 200 })
    const aP2 = await waitFor(
      () => a.events.slice(aEvCountB2).find((e) => e.playVersion >= p2.playVersion) ?? null,
      'A receives score adjust',
    )
    const bP2 = await waitFor(
      () => b.events.slice(bEvCountB2).find((e) => e.playVersion >= p2.playVersion) ?? null,
      'B receives score adjust',
    )
    const aScore = (aP2.playState as { teams?: Array<{ score?: number }> }).teams?.[0]?.score ?? 0
    const bScore = (bP2.playState as { teams?: Array<{ score?: number }> }).teams?.[0]?.score ?? 0
    check('A payload shows +200 score', aScore === 200, `got ${aScore}`)
    check('B payload shows +200 score', bScore === 200, `got ${bScore}`)

    // Reset
    await patchPlay({ kind: 'setTeamName', index: 0, name: 'Team 1' })
    await patchPlay({ kind: 'adjustTeamScore', index: 0, delta: -aScore })

    // ---- Test 3: concurrent CAS race ----
    console.log('\n[Test 3] concurrent CAS race (two parallel adjustTeamScore +100)')
    const baseline3 = await getBoard()
    const t0Score = (baseline3.playState as { teams?: Array<{ score?: number }> }).teams?.[0]?.score ?? 0
    const [r1, r2] = await Promise.all([
      patchPlay({ kind: 'adjustTeamScore', index: 0, delta: 100 }),
      patchPlay({ kind: 'adjustTeamScore', index: 0, delta: 100 }),
    ])
    check('both PATCHes succeeded with distinct playVersions', r1.playVersion !== r2.playVersion,
      `got ${r1.playVersion} and ${r2.playVersion}`)
    const finalGet = await getBoard()
    const finalScore = (finalGet.playState as { teams?: Array<{ score?: number }> }).teams?.[0]?.score ?? 0
    check('final team-0 score reflects BOTH ops (+200 net)', finalScore === t0Score + 200,
      `expected ${t0Score + 200}, got ${finalScore}`)
    check('final playVersion bumped by exactly 2',
      finalGet.playVersion === baseline3.playVersion + 2,
      `expected ${baseline3.playVersion + 2}, got ${finalGet.playVersion}`)

    // Reset score
    await patchPlay({ kind: 'adjustTeamScore', index: 0, delta: -200 })
  } finally {
    await a.cleanup()
    await b.cleanup()
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED ✓' : `${failures} check(s) FAILED ✗`}`)
  if (failures > 0) process.exit(1)
}

main().catch((err) => { console.error(err); process.exit(1) })
