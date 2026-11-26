import assert from 'node:assert/strict'
import test from 'node:test'
import schedule from '../data/crossword/full-size.json'
import { firstDay, shiftDay } from '../src/lib/daily'
import { normalizeCrossword } from '../src/lib/puzzle-rooms/crossword'

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
