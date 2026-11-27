/** Verifies the publisher date check, first-snapshot retention and the ranked replay without writing to the live database. */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { publisherOrbsDate, publisherOrbsForDay } from '../src/lib/daily/publisher-orbs'
import { VERIFIERS } from '../src/lib/daily/verify'
import { orbsDone, replayOrbs, type PublisherPuzzle } from '../src/lib/publisher-orbs'
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

const base = { id: 'p', description: 'Fixture', starThresholds: [1, 2, 3] as [number, number, number] }
const fixture = {
  orange: {
    ...base,
    type: 'bijection',
    title: 'Matches',
    pairs: [
      { id: 'a', itemA: 'Maple', itemB: 'Tree' },
      { id: 'b', itemA: 'Quartz', itemB: 'Mineral' },
      { id: 'c', itemA: 'Trout', itemB: 'Fish' },
    ],
    neutralPairs: [{ itemA: 'Maple', itemB: 'Fish' }],
  },
  green: {
    ...base,
    type: 'categorization',
    title: 'Sorting',
    categories: ['Liquid', 'Solid'],
    items: [{ id: 's', text: 'Ice', category: 'Solid' }],
  },
  blue: {
    ...base,
    type: 'themed',
    title: 'Clues',
    clues: [{ id: 'w', hint: 'South American capital', answers: ['Bogotá'] }],
    aliases: { Bogotá: ['Santa Fe de Bogota'] },
  },
  purple: { ...base, type: 'long-list', title: 'List', answers: ['apple', 'pear', 'peach', 'mango'] },
} satisfies Record<string, PublisherPuzzle>

test('a round replays its attempts into correct answers, misses and its end', () => {
  const { orange, green, blue, purple } = fixture
  const matched = replayOrbs(orange, [
    ['Maple', 'Fish'],
    ['Maple', 'Mineral'],
    ['Maple', 'Tree'],
  ])
  assert.deepEqual([matched?.correct, matched?.misses], [['a'], 1])
  const spent = replayOrbs(orange, [
    ['Maple', 'Mineral'],
    ['Quartz', 'Tree'],
    ['Trout', 'Tree'],
  ])
  assert.ok(spent && orbsDone(orange, spent))
  assert.equal(replayOrbs(orange, [...spent.moves!, ['Maple', 'Tree']]), null)
  assert.equal(replayOrbs(green, [['missing', 'Solid']]), null)
  assert.deepEqual(replayOrbs(blue, [['w', 'santa fe de bogota']])?.correct, ['w'])
  const list = replayOrbs(purple, [['plum'], ['Apple'], ['apple'], []])
  assert.deepEqual([list?.correct, list?.misses, list?.ended], [['0'], 0, true])
  assert.equal(replayOrbs(orange, [[]]), null)
})

test('the Orbs score check replays a finished publisher day and turns away unfinished or early ones', async (t) => {
  const day = '2026-11-26'
  const snapshot = {
    format: 'publisher-orbs-v1',
    sourceUrl: 'fixture',
    fetchedAt: day,
    edition: { dateKey: day, state: 'ready', puzzles: fixture },
  }
  t.mock.method(supabaseAdmin, 'from', () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: { payload: snapshot }, error: null }),
    }
    return query
  })
  const moves = {
    orange: [
      ['Maple', 'Tree'],
      ['Quartz', 'Mineral'],
      ['Maple', 'Mineral'],
      ['Trout', 'Tree'],
      ['Trout', 'Mineral'],
    ],
    green: [['s', 'Solid']],
    blue: [['w', 'Bogota']],
    purple: [['pear'], ['mango'], []],
  }
  const { moves: schema, check } = VERIFIERS.orbs
  assert.ok(schema.safeParse(moves).success)
  assert.ok(schema.safeParse({ ...moves, orange: [['a'.repeat(400), 'b']] }).success)
  assert.equal(schema.safeParse({ ...moves, purple: undefined }).success, false)
  assert.deepEqual(await check(day, moves as never, {}), { score: 6, stats: { n: 6, solved: false } })
  assert.equal(await check(day, { ...moves, purple: [['pear']] } as never, {}), 'Invalid or unfinished Orbs run')
  assert.match((await check('2026-11-25', moves as never, {})) as string, /ranks the publisher/)
})
