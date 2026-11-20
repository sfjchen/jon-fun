import { test } from 'node:test'
import assert from 'node:assert/strict'
import { features, isTriple, newDeal, findTriple, removeTriple, isOver } from '../src/lib/triples'
import { allSets, dailySetBoard } from '../src/lib/set-daily'
import { winners } from '../src/lib/score-stats'
test('SET deck represents 81 unique feature combinations and each distinct pair has exactly one third card', () => {
  assert.equal(new Set(Array.from({ length: 81 }, (_, i) => features(i).join(','))).size, 81)
  for (let a = 0; a < 81; a++)
    for (let b = a + 1; b < 81; b++)
      assert.equal(Array.from({ length: 81 }, (_, i) => i).filter((c) => isTriple(a, b, c)).length, 1)
})
test('daily boards are reproducible and contain exactly six sets across 100 days', () => {
  const puzzles = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const date = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10),
      b = dailySetBoard(date)
    assert.deepEqual(b, dailySetBoard(date))
    assert.equal(new Set(b).size, 12)
    assert.equal(allSets(b).length, 6)
    puzzles.add(b.join(','))
  }
  assert.equal(puzzles.size, 100)
})
test('full-deck deals never lose or duplicate cards and eventually end with no set', () => {
  for (let i = 0; i < 20; i++) {
    let deal = newDeal()
    const claimed: number[] = []
    while (!isOver(deal)) {
      const cards = findTriple(deal.board)
      assert.ok(cards)
      claimed.push(...cards)
      deal = removeTriple(deal, cards)
      assert.equal(new Set([...claimed, ...deal.board, ...deal.deck]).size, 81)
      assert.equal(claimed.length + deal.board.length + deal.deck.length, 81)
    }
    assert.equal(findTriple(deal.board), null)
  }
})
test('Wordle ties share the rank regardless of completion time', () => {
  const a = { name: 'Alice', game: 'fivefold' as const, day: '2026-11-17', score: 4, stats: { seconds: 100 } },
    b = { ...a, name: 'Bob', stats: { seconds: 80 } }
  assert.deepEqual(winners([a, b]), ['Alice', 'Bob'])
  assert.deepEqual(winners([a, { ...b, stats: { seconds: 100 } }]), ['Alice', 'Bob'])
})
