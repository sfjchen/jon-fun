import assert from 'node:assert/strict'
import test from 'node:test'
import schedule from '../data/crossword/full-size.json'
import { firstDay, shiftDay } from '../src/lib/daily'
import { supabaseAdmin } from '../src/lib/supabase'
import { crosswordForDay, normalizeCrossword } from '../src/lib/puzzle-rooms/crossword'

test('full-size crossword editions have consecutive dates and distinct fully checked grids', () => {
  const grids = new Set<string>()
  const first = schedule[0]!.date
  assert.equal(firstDay('crossword'), first, 'CROSSWORD_FIRST_DAY matches the schedule')
  for (const [index, edition] of schedule.entries()) {
    const day = shiftDay(first, index)
    const board = normalizeCrossword(edition, day)
    assert.equal(board.width, 15, day)
    assert.equal(board.height, 15, day)
    const open = board.blocks.flatMap((block, cell) => (block ? [] : [cell]))
    for (const direction of ['Across', 'Down']) {
      const cells = board.clues.filter((clue) => clue.direction === direction).flatMap((clue) => clue.cells)
      assert.deepEqual(
        cells.sort((a, b) => a - b),
        open,
        `${day} ${direction}`,
      )
    }
    const grid = board.solution.map((cell) => cell ?? '#').join('')
    assert.ok(!grids.has(grid), `Repeated grid on ${day}`)
    grids.add(grid)
  }
})

test('dates beyond the bundle use the generated schedule and preserve the first published edition', async (t) => {
  const first = shiftDay(schedule.at(-1)!.date, 1)
  const unavailable = shiftDay(first, 1)
  const distant = '2127-06-15'
  const published = new Map<string, unknown>()
  const source = t.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith(`${first}.json`)) return Response.json({ ...schedule[1], date: first })
    return new Response(null, { status: 404 })
  })
  t.mock.method(supabaseAdmin, 'from', () => ({
    select: () => ({
      eq: () => ({
        eq: (_dateColumn: string, day: string) => ({
          maybeSingle: async () => ({ data: published.has(day) ? { payload: published.get(day) } : null }),
        }),
      }),
    }),
    upsert: (row: { game: string; source_day: string; payload: unknown }, options: { ignoreDuplicates: boolean }) => ({
      select: () => ({
        maybeSingle: async () => {
          assert.equal(row.game, 'crossword-original')
          assert.equal(options.ignoreDuplicates, true)
          if (published.has(row.source_day)) return { data: null }
          published.set(row.source_day, row.payload)
          return { data: { source_day: row.source_day } }
        },
      }),
    }),
  }))

  const generated = await crosswordForDay(first, false)
  assert.deepEqual(generated.solution, schedule[1]!.cells)
  assert.equal(generated.title, 'Daily Crossword')

  const encore = await crosswordForDay(unavailable, false)
  assert.equal(encore.title, 'Daily Crossword · Encore')
  assert.equal(encore.date, unavailable)
  assert.equal((await crosswordForDay(distant, false)).width, 15)

  source.mock.mockImplementation(async () => Response.json({ ...schedule[2], date: unavailable }))
  assert.deepEqual(await crosswordForDay(unavailable, false), encore)
  assert.equal(source.mock.callCount(), 3)
})
