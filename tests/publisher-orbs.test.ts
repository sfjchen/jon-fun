/** Verifies the publisher date check and first-snapshot retention without writing to the live database. */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { publisherOrbsDate, publisherOrbsForDay } from '../src/lib/daily/publisher-orbs'
import { supabaseAdmin } from '../src/lib/supabase'

test('the publisher archive accepts only real, published-range dates', () => {
  assert.equal(publisherOrbsDate('2026-04-17'), true)
  assert.equal(publisherOrbsDate('2026-04-16'), false)
  assert.equal(publisherOrbsDate('2026-02-30'), false)
  assert.equal(publisherOrbsDate('2099-01-01'), false)
})

test('Daily Orbs saves the exact edition once and rejects mismatched or unpublished responses', async (t) => {
  const day = '2026-11-25'
  const pair = { id: 'pair-1', itemA: 'Original prompt', itemB: 'Original answer', display: 'Original display text' }
  const puzzle = { id: 'puzzle-1', title: 'Publisher test fixture', type: 'bijection', pairs: [pair] }
  const edition = {
    dateKey: day,
    state: 'deja-vu',
    originalDate: '2026-11-24',
    puzzles: { orange: puzzle, green: puzzle, blue: puzzle, purple: puzzle },
    additionalSourceField: 'preserved',
  }
  let upstream = { ...edition, dateKey: '2026-11-24' }
  const snapshots = new Map<string, unknown>()
  const fetch = t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, `https://api.dailyorbs.com/api/game-day?date=${day}`)
    return Response.json(upstream)
  })
  t.mock.method(supabaseAdmin, 'from', (table: string) => {
    assert.equal(table, 'daily_game_content')
    let sourceDay = ''
    const query = {
      select() {
        return query
      },
      eq(field: string, value: string) {
        if (field === 'source_day') sourceDay = value
        else assert.equal(value, 'publisher-orbs')
        return query
      },
      async maybeSingle() {
        const snapshot = snapshots.get(sourceDay)
        return { data: snapshot ? { payload: snapshot } : null, error: null }
      },
      async upsert(row: { game: string; source_day: string; payload: unknown }, policy: unknown) {
        assert.equal(row.game, 'publisher-orbs')
        assert.deepEqual(policy, { onConflict: 'game,source_day', ignoreDuplicates: true })
        if (!snapshots.has(row.source_day)) snapshots.set(row.source_day, row.payload)
        return { error: null }
      },
    }
    return query
  })

  await assert.rejects(publisherOrbsForDay(day), /did not return the published edition/)
  upstream = { ...edition, state: 'unavailable' }
  await assert.rejects(publisherOrbsForDay(day), /did not return the published edition/)
  assert.equal(snapshots.size, 0)
  upstream = edition
  const [first, second] = await Promise.all([publisherOrbsForDay(day), publisherOrbsForDay(day)])
  assert.deepEqual(first, second)
  assert.deepEqual(first.edition, edition)
  assert.equal(first.format, 'publisher-orbs-v1')
  upstream = { ...edition, additionalSourceField: 'changed' }
  assert.deepEqual(await publisherOrbsForDay(day), first)
  assert.equal(fetch.mock.callCount(), 3)
})
