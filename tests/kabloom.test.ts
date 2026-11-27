/** Checks Kabloom judging, score replay and the exact-date loader against the synthetic publisher fixture only. */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import synthetic from './fixtures/publisher/kabloom-synthetic.json'
import { siteDay } from '../src/lib/daily'
import { kabloomForDay } from '../src/lib/daily/kabloom'
import { judgeKabloom, kabloomClock, replayKabloom, type KabloomPuzzle } from '../src/lib/kabloom'
import { savePublisherEdition } from '../src/lib/publisher-editions/local'

const puzzle = { date: synthetic.sourceDate, editionId: synthetic.editionId, ...synthetic.payload } as KabloomPuzzle
const { complete, spentAnswer } = synthetic.payload.referenceRuns

test('Kabloom replays the reference runs and rejects forged or illegal climbs', () => {
  const moves = (ids: string[], ms = 1000) => ids.map((id) => ({ id, ms }))
  assert.equal(replayKabloom(puzzle, moves(complete.answers)), complete.cleared)
  assert.equal(replayKabloom(puzzle, moves(spentAnswer.answers)), spentAnswer.cleared)
  assert.equal(replayKabloom(puzzle, []), 0)
  assert.match(String(replayKabloom(puzzle, moves(['ember', 'ember']))), /twice/)
  assert.match(String(replayKabloom(puzzle, moves(['twig']))), /does not fit/)
  assert.match(String(replayKabloom(puzzle, moves(['coal'], 25001))), /after its clock/)
  assert.match(String(replayKabloom(puzzle, moves([...complete.answers, 'oak']))), /Too many/)
})

test('Kabloom judges aliases, spent answers, wrong rounds and spelling suggestions', () => {
  assert.deepEqual(judgeKabloom(puzzle, 0, [], '  Glowing EMBER! '), { kind: 'clear', id: 'ember' })
  assert.deepEqual(judgeKabloom(puzzle, 1, ['ember'], 'ember'), { kind: 'spent', id: 'ember' })
  assert.deepEqual(judgeKabloom(puzzle, 0, [], 'oak'), { kind: 'miss', id: 'oak' })
  assert.deepEqual(judgeKabloom(puzzle, 0, [], 'volcano'), { kind: 'unknown' })
  assert.deepEqual(judgeKabloom(puzzle, 4, [], 'birchh'), { kind: 'suggest', id: 'birch', label: 'Birch' })
  assert.deepEqual(judgeKabloom(puzzle, 4, [], 'birchh', true), { kind: 'clear', id: 'birch' })
  // Spending Ember in round 1 leaves round 2 with no unused accepted answer.
  const left = puzzle.rounds[1]!.accepted.filter((id) => !spentAnswer.answers.includes(id))
  assert.equal(left.length, 0)
})

test('Kabloom clock reads first, then answers, and a reload resumes the same wall-clock deadline', () => {
  assert.deepEqual(kabloomClock(puzzle, 0, 500), { reading: 1500, left: 25000 })
  assert.deepEqual(kabloomClock(puzzle, 0, 12000), { reading: 0, left: 15000 })
  assert.deepEqual(kabloomClock(puzzle, 0, 30000), { reading: 0, left: 0 })
})

test('Kabloom loads only the exact archived date, keyed by the Pacific day at New York midnight', async () => {
  const cwd = process.cwd()
  const dir = await mkdtemp(path.join(tmpdir(), 'kabloom-'))
  try {
    process.chdir(dir)
    await savePublisherEdition('kabloom', synthetic.sourceDate, synthetic)
    const loaded = await kabloomForDay(synthetic.sourceDate)
    assert.equal(loaded.editionId, synthetic.editionId)
    assert.equal('referenceRuns' in loaded, false)
    await assert.rejects(kabloomForDay('2000-01-02'), /No Kabloom edition/)
    // 00:30 in New York on Nov 28 is still Nov 27 in the site's Pacific calendar, so Nov 27's edition opens.
    assert.equal(siteDay(new Date('2026-11-28T05:30:00Z')), '2026-11-27')
  } finally {
    process.chdir(cwd)
    await rm(dir, { recursive: true, force: true })
  }
})
