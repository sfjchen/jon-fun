/** Exercises the ranked Orbs verifier with the real bank and checks tiered overall wins. */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dailyPuzzle } from '../src/lib/daily/server'
import { VERIFIERS } from '../src/lib/daily/verify'
import { ORBS_BOARD_FIRST_DAY, ORBS_FIRST_DAY, ORBS_MAX, orbsWrittenPick, type OrbsPuzzle } from '../src/lib/orbs'
import { overallDay } from '../src/lib/score-stats'
import type { BoardRow } from '../src/lib/results'

test('Orbs replays perfect and partial runs, and rejects incomplete or invalid picks', async () => {
  const { day, sourceDate, puzzle } = await dailyPuzzle('orbs', ORBS_FIRST_DAY)
  assert.equal(sourceDate, day)
  const answers = (puzzle as OrbsPuzzle).categories.flatMap((category) => category.questions.map((q) => q.answer))
  const verifier = VERIFIERS.orbs
  const perfect = verifier.moves.safeParse(answers)
  assert.ok(perfect.success)
  assert.deepEqual(await verifier.check(day, perfect.data as never, {}), {
    score: ORBS_MAX,
    stats: { n: ORBS_MAX, solved: true },
  })
  const mixed = verifier.moves.safeParse(answers.map((a, i) => (i % 2 ? (a + 1) % 3 : a)))
  assert.ok(mixed.success)
  assert.deepEqual(await verifier.check(day, mixed.data as never, {}), {
    score: ORBS_MAX / 2,
    stats: { n: ORBS_MAX / 2, solved: false },
  })
  assert.equal(verifier.moves.safeParse(answers.slice(1)).success, false)
  assert.equal(verifier.moves.safeParse([3, ...answers.slice(1)]).success, false)
})

test('a mixed-format Orbs board replays to the same maximum and normalizes written answers', async () => {
  const { puzzle } = await dailyPuzzle('orbs', ORBS_BOARD_FIRST_DAY)
  const { categories } = puzzle as OrbsPuzzle
  assert.deepEqual(
    categories.map((category) => category.format),
    ['choice', 'type', 'match', 'sort'],
  )
  const clue = categories.find((category) => category.format === 'type')!.questions[0]!
  assert.equal(orbsWrittenPick(clue, `  ${clue.options[clue.answer].toUpperCase()} `), clue.answer)
  assert.notEqual(orbsWrittenPick(clue, 'incorrect guess'), clue.answer)
  const picks = categories.flatMap((category) => category.questions.map((question) => question.answer))
  const result = await VERIFIERS.orbs.check(ORBS_BOARD_FIRST_DAY, picks as never, {})
  assert.deepEqual(result, { score: ORBS_MAX, stats: { n: ORBS_MAX, solved: true } })
})

test('a lower-tier win counts for its game but does not decide the overall day', () => {
  const rows: BoardRow[] = [
    { name: 'Alice', game: 'fivefold', day: ORBS_FIRST_DAY, score: 5, stats: {} },
    { name: 'Bob', game: 'fivefold', day: ORBS_FIRST_DAY, score: 3, stats: {} },
    { name: 'Alice', game: 'orbs', day: ORBS_FIRST_DAY, score: 9, stats: {} },
    { name: 'Bob', game: 'orbs', day: ORBS_FIRST_DAY, score: 12, stats: {} },
  ]
  assert.deepEqual(overallDay(rows).names, ['Alice'])
  assert.deepEqual(overallDay(rows, 'orbs').names, ['Bob'])
})
