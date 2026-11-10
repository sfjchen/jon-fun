/**
 * Verifies 1 Sentence Everyday merge rules (no browser): newest updatedAt wins per day,
 * tombstones beat older copies, invalid timestamps never win, and merging is order-independent.
 * Run: npm run verify:daily-learn-merge
 */

import assert from 'node:assert/strict'

import { mergeEntries, type DailyLearnEntry } from '../src/lib/dailyLearn'

const e = (date: string, text: string, updatedAt: string): DailyLearnEntry => ({ date, text, updatedAt })

const local = [
  e('2020-01-01', 'local newer', '2020-01-03T00:00:00.000Z'),
  e('2020-01-02', '', '2020-01-05T00:00:00.000Z'),
  e('2020-01-03', 'only local', '2020-01-03T00:00:00.000Z'),
  e('2020-01-04', 'bad stamp', 'not a date'),
]
const remote = [
  e('2020-01-01', 'remote older', '2020-01-02T00:00:00.000Z'),
  e('2020-01-02', 'remote before delete', '2020-01-04T00:00:00.000Z'),
  e('2020-01-04', 'valid stamp', '2020-01-01T00:00:00.000Z'),
  e('2020-01-05', 'only remote', '2020-01-05T00:00:00.000Z'),
]

const text = (m: DailyLearnEntry[]) => Object.fromEntries(m.map((x) => [x.date, x.text]))
const want = {
  '2020-01-01': 'Local newer',
  '2020-01-02': '',
  '2020-01-03': 'Only local',
  '2020-01-04': 'Valid stamp',
  '2020-01-05': 'Only remote',
}
assert.deepEqual(text(mergeEntries(local, remote)), want)
assert.deepEqual(text(mergeEntries(remote, local)), want)
assert.deepEqual(text(mergeEntries(mergeEntries(local, remote), remote)), want)
console.log('verify-daily-learn-merge: ok')
