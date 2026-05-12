/**
 * Verify RFC 4180 CSV round-trip for 1 Sentence Everyday (no browser).
 * Run: npm run verify:daily-learn-csv
 */

import assert from 'node:assert/strict'

import { formatDailyLearnCsv, parseDailyLearnCsv } from '../src/lib/dailyLearnCsv'

const fixtures = [
  {
    date: '2020-01-01',
    text: 'Comma, inside',
    updatedAt: '2020-01-01T12:00:00.000Z',
  },
  {
    date: '2020-01-02',
    text: 'Say "hello"',
    updatedAt: '2020-01-02T13:00:00.000Z',
  },
  {
    date: '2020-01-03',
    text: 'Line one\nLine two',
    updatedAt: '2020-01-03T14:00:00.000Z',
  },
]

function rt(entries: typeof fixtures): void {
  const csv = formatDailyLearnCsv(entries)
  const bomCsv = `\uFEFF${csv}`
  for (const variant of [csv, bomCsv]) {
    const { entries: parsed, error } = parseDailyLearnCsv(variant)
    assert.ifError(error)
    assert.equal(parsed.length, entries.length)
    const byDate = new Map(parsed.map((e) => [e.date, e]))
    for (const ex of entries) {
      const got = byDate.get(ex.date)
      assert.ok(got)
      assert.equal(got!.text, ex.text)
      assert.equal(got!.updatedAt, ex.updatedAt)
    }
  }
}

rt(fixtures)

// Column order in header row should still parse
const shuffledHeader =
  'updatedAt,text,date\n2021-05-05T10:00:00.000Z,"Last, first",2021-05-05'
const shuffled = parseDailyLearnCsv(shuffledHeader)
assert.ifError(shuffled.error)
assert.equal(shuffled.entries.length, 1)
assert.equal(shuffled.entries[0]!.text, 'Last, first')

const bad = parseDailyLearnCsv('x,y\nnot-a-date,hello')
assert.ok(bad.error)

console.log('daily-learn CSV verify ok:', fixtures.length + 1, 'round-trip checks')
