/** Checks exact edition dates and offline format fidelity without any publisher credentials. */
import assert from 'node:assert/strict'
import test from 'node:test'
import synthetic from './fixtures/publisher/kabloom-synthetic.json'
import headcount from '../data/headcount/2026-11-26.json'
import { fermiErrorFactor, validatePublisherEdition } from '../src/lib/publisher-editions/formats'
import { crosswordFromIpuz } from '../src/lib/puzzle-rooms/ipuz'
import { normalizeCrossword } from '../src/lib/puzzle-rooms/crossword'

test('Kabloom fixture retains answer ordering and rejects undeclared answers and wrong dates', () => {
  assert.deepEqual(validatePublisherEdition('kabloom', synthetic.sourceDate, synthetic).payload, synthetic.payload)
  const malformed = structuredClone(synthetic)
  malformed.payload.rounds[0]!.accepted.push('missing')
  assert.throws(() => validatePublisherEdition('kabloom', synthetic.sourceDate, malformed), /undeclared/)
  assert.throws(() => validatePublisherEdition('kabloom', '2000-01-02', synthetic), /different edition/)
})

test('Headcount requires the nested party date even if the response echoes the request', () => {
  const sample = {
    format: 'publisher-edition/v1',
    game: 'headcount',
    editionId: headcount.number,
    sourceDate: headcount.date,
    sourceUrl: 'https://headcountgame.com/',
    payload: { date: headcount.date, party: headcount },
  }
  assert.equal(validatePublisherEdition('headcount', headcount.date, sample).editionId, headcount.number)
  assert.throws(
    () =>
      validatePublisherEdition('headcount', headcount.date, {
        ...sample,
        payload: { ...sample.payload, party: { ...headcount, date: '2026-11-27' } },
      }),
    /nested Headcount party/,
  )
})

test('Fermi error factor is one for an exact answer and symmetric for multiples', () => {
  assert.equal(fermiErrorFactor(10, 10), 1)
  assert.equal(fermiErrorFactor(10, 50), 5)
  assert.equal(fermiErrorFactor(50, 10), 5)
  assert.throws(() => fermiErrorFactor(0, 10), /positive/)
})

test('authorized blocked ipuz imports preserve clue order, circled cells, date, and identity', () => {
  const value = {
    version: 'http://ipuz.org/v2',
    kind: ['http://ipuz.org/crossword#1'],
    date: '01/01/2000',
    dimensions: { width: 3, height: 3 },
    uniqueid: 'synthetic-ipuz',
    puzzle: [
      [1, 2, 3],
      [4, { style: 'circle' }, 0],
      [5, 0, 0],
    ],
    styles: { circle: { shapebg: 'circle' } },
    solution: [
      ['C', 'A', 'T'],
      ['A', 'R', 'E'],
      ['T', 'E', 'N'],
    ],
    clues: {
      Across: [
        [5, 'Number after nine'],
        [1, '<em>Domestic</em> feline'],
        [4, 'Plural form of is'],
      ],
      Down: [
        [1, 'Feline'],
        [2, 'Plural copula'],
        [3, 'Half of twenty'],
      ],
    },
  }
  const date = '2000-01-01'
  const board = normalizeCrossword(crosswordFromIpuz(value, date), date)
  assert.equal(board.editionId, value.uniqueid)
  assert.deepEqual(
    board.clues.slice(0, 3).map((clue) => clue.number),
    ['5', '1', '4'],
  )
  assert.deepEqual(board.circles, [4])
  assert.equal(board.clues[1]?.text, 'Domestic feline')
  assert.throws(() => crosswordFromIpuz(value, '2000-01-02'), /publication date/)
  assert.throws(() => crosswordFromIpuz({ ...value, styles: { circle: { barred: 'L' } } }, date))
})
