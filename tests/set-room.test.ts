import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'
import { NextRequest } from 'next/server'
loadEnvConfig(process.cwd())
// Seat tokens are signed with the service key. The database is mocked below, so a stand-in works without .env.local.
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-only-seat-secret'
test('room storage failures are retryable, missing rooms are 404, and roster IDs cannot authorize actions', async () => {
  const { supabaseAdmin } = await import('../src/lib/supabase')
  const { playerToken, validPlayerToken } = await import('../src/lib/triples-server')
  const { GET, POST } = await import('../src/app/api/triples/rooms/[pin]/route')
  const descriptor = Object.getOwnPropertyDescriptor(supabaseAdmin, 'from')
  let failed = true
  let data: unknown = null
  const builder = {
    select() {
      return this
    },
    eq() {
      return this
    },
    async maybeSingle() {
      return { data, error: failed ? { message: 'Simulated database outage' } : null }
    },
  }
  Object.defineProperty(supabaseAdmin, 'from', { value: () => builder, configurable: true })
  const params = { params: Promise.resolve({ pin: '1234' }) }
  try {
    const token = playerToken('1234', 'host')
    assert.equal(validPlayerToken('1234', 'host', token), true)
    assert.equal(validPlayerToken('1234', 'guest', token), false)
    assert.equal(validPlayerToken('5678', 'host', token), false)
    assert.equal((await GET(new NextRequest('http://localhost/api/triples/rooms/1234'), params)).status, 503)
    const request = (body: object) =>
      new NextRequest('http://localhost/api/triples/rooms/1234', { method: 'POST', body: JSON.stringify(body) })
    assert.equal((await POST(request({ action: 'start', playerId: 'host', playerToken: token }), params)).status, 503)
    assert.equal((await POST(request({ action: 'start', playerId: 'host' }), params)).status, 403)
    failed = false
    data = { host_id: 'legacy-host', players: [{ id: 'legacy-host', name: 'Legacy Alice', score: 0, misses: 0 }] }
    assert.equal(
      (await GET(new NextRequest('http://localhost/api/triples/rooms/1234'), params)).status,
      404,
      'Uncredentialed legacy rooms are explicitly retired',
    )
    data = null
    assert.equal((await GET(new NextRequest('http://localhost/api/triples/rooms/1234'), params)).status, 404)
  } finally {
    if (descriptor) Object.defineProperty(supabaseAdmin, 'from', descriptor)
    else Reflect.deleteProperty(supabaseAdmin, 'from')
  }
})
