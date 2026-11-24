import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyMini,
  miniElapsed,
  pauseMini,
  resumeMini,
  finishMini,
  rankAutochecked,
  type MiniPuzzle,
} from '../src/lib/mini'
import {
  newKrillionRun,
  beginKrillionRound,
  restoreKrillionRun,
  completeKrillionRound,
  pauseKrillionRun,
} from '../src/lib/krillion'
import { artifactScore, regionDistance, type Artifact } from '../src/lib/artifact-scoring'
import { winners } from '../src/lib/score-stats'
import { score, check, rankIdx } from '../src/lib/spelling-bee'
import { judgeAnswer, krillionForDay } from '../src/lib/daily/krillion'
const mini: MiniPuzzle = {
  date: '2026-11-17',
  width: 1,
  height: 1,
  cells: ['A'],
  clues: [{ number: '1', direction: 'Across', text: 'First letter', cells: [0], answer: 'A' }],
  constructors: [],
  copyright: '',
}
test('Mini accumulates only active time, pauses on leave, and records the first unassisted solve', () => {
  let r = resumeMini(emptyMini(mini), 1000)
  r = pauseMini(r, 4500)
  assert.equal(miniElapsed(r, 900000), 3500)
  r = resumeMini(r, 10000)
  r = finishMini({ ...r, entries: ['A'] }, mini, 13000)
  assert.equal(r.firstSolveSeconds, 7)
  assert.equal(r.elapsedMs, 6500)
  const replay = finishMini(
    { ...resumeMini({ ...emptyMini(mini), firstSolveSeconds: 6 }, 20000), entries: ['A'] },
    mini,
    21000,
  )
  assert.equal(replay.firstSolveSeconds, 6)
  assert.equal(finishMini({ ...emptyMini(mini), entries: ['A'], assisted: true }, mini, 0).firstSolveSeconds, null)
  // A finished assisted run from before Autocheck ranked becomes a ranked solve, and a current one stays assisted.
  const legacy = { ...emptyMini(mini), entries: ['A'], assisted: true, complete: true, elapsedMs: 41400, v: 1 }
  assert.deepEqual([rankAutochecked(legacy).assisted, rankAutochecked(legacy).firstSolveSeconds], [false, 41])
  assert.equal(rankAutochecked({ ...legacy, v: 2 }).assisted, true)
  assert.equal(rankAutochecked({ ...legacy, complete: false }).assisted, true)
})
test('Krillion reload cannot reset an expired timer', () => {
  let r = beginKrillionRound(newKrillionRun(), 1000)
  r = restoreKrillionRun(r, 4500)
  assert.equal(r.phase, 'answering')
  assert.equal(r.endsAt, 26000)
  const expired = restoreKrillionRun(r, 30000)
  assert.equal(expired.phase, 'feedback')
  assert.equal(expired.outcomes[0]?.score, 0)
  assert.equal(
    completeKrillionRound(expired, { answer: 'x', accepted: true, score: 100, reason: 'Test catch' }).outcomes.length,
    1,
  )
})
test('Krillion clock stands still while the page is closed', () => {
  const left = pauseKrillionRun(beginKrillionRound(newKrillionRun(), 1000), 6000)
  const back = restoreKrillionRun(JSON.parse(JSON.stringify(left)), 900000)
  assert.equal(back.phase, 'answering')
  assert.equal(back.endsAt, 920000)
  assert.equal(back.pausedAt, undefined)
  const late = beginKrillionRound(newKrillionRun(), 1000)
  assert.equal(pauseKrillionRun(late, 26000), late)
})
test('Original same-day Krillion key reproduces the completed reference run and includes exact aliases', async () => {
  const answers = ['Zootopia', 'Taco', 'Rhinoceros', 'Michael Jordan', 'Louisville', 'Apple', 'Jett']
  const result = await Promise.all(answers.map((a, i) => judgeAnswer('2026-11-17', i, a)))
  assert.deepEqual(
    result.map((r) => r.score),
    [10, 10, 10, 10, 10, 10, 30],
  )
  assert.equal(
    result.reduce((s, r) => s + r.score, 0),
    90,
  )
  assert.equal((await judgeAnswer('2026-11-17', 0, 'ten lives')).score, 85)
  assert.equal((await judgeAnswer('2026-11-17', 0, 'The Karnival Kid')).score, 100)
  assert.equal((await judgeAnswer('2026-11-17', 0, 'qzxqzxqzxqzx')).accepted, false)
  assert.equal((await krillionForDay('2026-11-17')).date, '2026-11-17')
})
test('Anthropeum matches original interval and polygon-edge scoring formulas', () => {
  const polygons = [
    [
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
        [-1, -1],
      ],
    ],
  ]
  const a: Artifact = {
    id: 1,
    title: 'Test',
    images: [],
    objectDate: '200–220',
    beginYear: 200,
    endYear: 220,
    culture: 'test',
    metUrl: '',
    polygons,
  }
  assert.equal(artifactScore(a, { lat: 0, lon: 0 }, 0).total, 10000)
  const edge = regionDistance({ lat: 0, lon: 2 }, polygons)
  assert.ok(edge > 110 && edge < 112)
  const later = artifactScore({ ...a, beginYear: 500, endYear: 500 }, { lat: 0, lon: 0 }, 0)
  assert.equal(later.years, 250)
  assert.equal(later.time, Math.round(5000 * Math.exp(-0.25)))
})
test('Mini winners use lower time, Connections uses completion time; zero-second Mini is valid', () => {
  const row = { day: '2026-11-17', game: 'mini' as const, stats: {}, name: 'Alice', score: 0 }
  assert.deepEqual(winners([row, { ...row, name: 'Bob', score: 20 }]), ['Alice'])
  assert.deepEqual(
    winners([
      { ...row, game: 'connections', score: 4, stats: { mistakes: 1, seconds: 80 } },
      { ...row, game: 'connections', name: 'Bob', score: 4, stats: { mistakes: 0, seconds: 100 } },
    ]),
    ['Alice'],
  )
})
test('Bee scoring, center-letter requirements, duplicate checks, and Genius/Queen ranks', () => {
  assert.equal(score('acne'), 1)
  assert.equal(score('alone'), 5)
  assert.equal(score('abcdefg'), 14)
  const p = {
    id: 'eaclnow',
    center: 'e',
    outer: ['a', 'c', 'l', 'n', 'o', 'w'],
    answers: ['acne', 'alone'],
    pangrams: [],
    max: 6,
  }
  assert.equal(check('acne', p, []), null)
  assert.equal(check('acne', p, ['acne']), 'Already found')
  assert.equal(check('clan', p, []), 'Missing center letter')
  assert.equal(rankIdx(68, 97), 8)
  assert.equal(rankIdx(97, 97), 9)
})

test('Daily Learn keeps both texts only when a device joins a sync key, and takes the newest otherwise', async () => {
  const { mergeEntries } = await import('../src/lib/dailyLearn')
  const a = { date: '2026-11-01', text: 'From laptop', updatedAt: '2026-11-01T10:00:00.000Z' }
  const b = { date: '2026-11-01', text: 'From phone', updatedAt: '2026-11-01T11:00:00.000Z' }
  // Joining a sync key meets a different text, so the newer shows and the older is kept.
  const [clash] = mergeEntries([a], [b], true)
  assert.deepEqual([clash!.text, clash!.conflict], ['From phone', 'From laptop'])
  // A side that already holds the pair takes it without recording the clash again.
  assert.equal(mergeEntries([a], [clash!], true)[0]!.conflict, 'From laptop')
  // The same account on another device, or an import, just takes the newest.
  assert.deepEqual([mergeEntries([a], [b])[0]!.text, mergeEntries([a], [b])[0]!.conflict], ['From phone', undefined])
  assert.equal(mergeEntries([b], [a])[0]!.text, 'From phone')
})
