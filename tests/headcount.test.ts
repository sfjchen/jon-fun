import assert from 'node:assert/strict'
import { test } from 'node:test'
import party from '../data/headcount/2026-11-26.json'
import { headcountEdition, roomPoints } from '../src/lib/headcount'

test('Headcount replays all five rooms and rejects malformed moves', () => {
  const board = headcountEdition.parse(party)
  const perfect = [[44], [1, 2, 0, 3], [3], [1], [46, 22, 32]]
  const invalid = [[101], [0, 0, 2, 3], [-1], [9], [46, 22, 31]]
  for (const [i, q] of board.questions.entries()) {
    assert.equal(roomPoints(q, perfect[i]!), 20)
    assert.equal(roomPoints(q, invalid[i]!), null)
  }
  assert.equal(roomPoints(board.questions[0]!, [37]), 18)
  assert.equal(roomPoints(board.questions[3]!, [0]), 20)
  assert.equal(roomPoints(board.questions[4]!, [36, 32, 32]), 17)
})
