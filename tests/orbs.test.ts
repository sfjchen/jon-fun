/** Exercises the sfjc.dev practice bank's round replay and checks that Orbs counts like any game overall. */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dailyPuzzle } from '../src/lib/daily/server'
import { ORBS_BOARD_FIRST_DAY, ORBS_FIRST_DAY, orbsWrittenPick, type OrbsPuzzle } from '../src/lib/orbs'
import { ORBS_LIVES, replayOrbsRound } from '../src/lib/orbs-run'
import { overallDay } from '../src/lib/score-stats'
import type { BoardRow } from '../src/lib/results'

test('a practice round has 3 lives, normalizes written answers and rejects attempts after it ends', async () => {
  const { puzzle } = await dailyPuzzle('orbs', ORBS_BOARD_FIRST_DAY)
  const { categories } = puzzle as OrbsPuzzle
  assert.deepEqual(
    categories.map((category) => category.format),
    ['choice', 'type', 'match', 'sort'],
  )
  const clue = categories.find((category) => category.format === 'type')!.questions[0]!
  assert.equal(orbsWrittenPick(clue, `  ${clue.options[clue.answer].toUpperCase()} `), clue.answer)
  assert.notEqual(orbsWrittenPick(clue, 'incorrect guess'), clue.answer)
  const match = categories.find((category) => category.format === 'match')!
  const correct = match.questions[0]!.answer
  const wrong = ((correct + 1) % 3) as 0 | 1 | 2
  const opened = { legacy: [], attempts: [{ clue: 0, pick: wrong }] }
  assert.equal(replayOrbsRound(match, opened)?.lives, ORBS_LIVES - 1)
  const retry = { ...opened, attempts: [...opened.attempts, { clue: 0, pick: correct }] }
  assert.equal(replayOrbsRound(match, retry)?.score, 1)
  assert.equal(replayOrbsRound(match, { ...retry, attempts: [...retry.attempts, { clue: 1, pick: correct }] }), null)
})

test('every game counts the same toward the overall day', () => {
  const rows: BoardRow[] = [
    { name: 'Alice', game: 'fivefold', day: ORBS_FIRST_DAY, score: 5, stats: {} },
    { name: 'Bob', game: 'fivefold', day: ORBS_FIRST_DAY, score: 3, stats: {} },
    { name: 'Alice', game: 'orbs', day: ORBS_FIRST_DAY, score: 9, stats: {} },
    { name: 'Bob', game: 'orbs', day: ORBS_FIRST_DAY, score: 12, stats: {} },
  ]
  assert.deepEqual(overallDay(rows).names, ['Alice', 'Bob'])
  assert.deepEqual(overallDay(rows, 'orbs').names, ['Bob'])
})

test('practice editions exist across the bank cutoff and a missing year file', async () => {
  for (const day of ['2026-12-07', '2027-01-01']) {
    const { puzzle, sourceDate } = await dailyPuzzle('orbs', day)
    assert.equal(sourceDate, day)
    assert.deepEqual(
      (puzzle as OrbsPuzzle).categories.map((category) => category.id),
      ['trivia', 'words', 'geography', 'science'],
    )
  }
})
