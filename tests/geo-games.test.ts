/** Checks the geography dailies: every date draws a playable puzzle, and each replay scores and rejects as designed. */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import world from '../data/geo/world.json'
import {
  arrow,
  ballparkPoints,
  ballparkPuzzle,
  ballparkRun,
  findByName,
  hopPuzzle,
  hopRun,
  hops,
  outlinePuzzle,
  outlineRun,
  parseEstimate,
  pinPuzzle,
  pinRun,
  type World,
} from '../src/lib/geo-games'
import { shiftDay } from '../src/lib/daily'

const w = world as World

test('a date always draws the same puzzle, and a year of dates is playable', () => {
  assert.deepEqual(hopPuzzle(w, '2026-11-27'), hopPuzzle(w, '2026-11-27'))
  for (let i = 0; i < 365; i++) {
    const day = shiftDay('2026-11-27', i),
      hop = hopPuzzle(w, day)
    assert.equal(hops(hop.countries, hop.from).get(hop.to), hop.best + 1)
    assert.ok(hop.best >= 2 && hop.best <= 4)
    assert.ok(outlinePuzzle(w, day).path.length > 40)
    assert.equal(new Set(pinPuzzle(w, day).cities.map((c) => c.name)).size, 5)
    assert.ok(ballparkPuzzle(w, day).questions.every((q) => q.answer > 0))
  }
})

test('Outline scores 7 minus the guesses and takes nothing after the answer', () => {
  const p = outlinePuzzle(w, '2026-11-27'),
    other = p.countries.filter((c) => c.id !== p.target).map((c) => c.id)
  assert.deepEqual(outlineRun(p, [p.target]), { score: 6, done: true, solved: true })
  assert.deepEqual(outlineRun(p, [other[0]!, p.target]), { score: 5, done: true, solved: true })
  assert.deepEqual(outlineRun(p, other.slice(0, 6)), { score: 0, done: true, solved: false })
  assert.equal(outlineRun(p, [other[0]!])!.done, false)
  assert.equal(outlineRun(p, [p.target, other[0]!]), null)
  assert.equal(outlineRun(p, [other[0]!, other[0]!]), null)
  assert.equal(outlineRun(p, ['XXX']), null)
})

test('Border hop ends when the guesses link the ends, and extra countries cost 15 each', () => {
  const p = hopPuzzle(w, '2026-11-27'),
    steps = hops(p.countries, p.from),
    route: string[] = []
  for (let at = p.to; steps.get(at)! > 1;) {
    at = p.countries.find((c) => c.id === at)!.nb.find((n) => steps.get(n) === steps.get(at)! - 1)!
    route.push(at)
  }
  assert.deepEqual(hopRun(p, route), { score: 100, done: true, solved: true })
  assert.equal(hopRun(p, route.slice(1))!.done, false)
  const spare = p.countries.find((c) => !route.includes(c.id) && c.id !== p.from && c.id !== p.to)!.id
  assert.equal(hopRun(p, [spare, ...route])!.score, 85)
  assert.equal(hopRun(p, [...route, spare]), null)
  assert.equal(hopRun(p, [p.from]), null)
})

test('Pin drop and Ballpark score by distance and by ratio', () => {
  const pin = pinPuzzle(w, '2026-11-27')
  assert.deepEqual(pinRun(pin, pin.cities), { score: 5000, done: true, solved: true })
  assert.equal(pinRun(pin, [{ lat: 91, lon: 0 }]), null)
  assert.deepEqual([ballparkPoints(1000, 1000), ballparkPoints(1000, 2000), ballparkPoints(1000, 500)], [100, 70, 70])
  assert.equal(ballparkPoints(1000, 10000), 0)
  const b = ballparkPuzzle(w, '2026-11-27')
  assert.equal(
    ballparkRun(
      b,
      b.questions.map((q) => q.answer),
    )!.score,
    300,
  )
  assert.equal(ballparkRun(b, [0]), null)
})

test('typed names and numbers are read loosely', () => {
  assert.equal(findByName(w.countries, 'ivory coast')?.id, 'CIV')
  assert.equal(findByName(w.countries, 'sao tome and principe')?.id, 'STP')
  assert.equal(findByName(w.countries, 'united'), undefined)
  assert.equal(findByName(w.countries, 'united k')?.id, 'GBR')
  assert.deepEqual(['1,200', '3.5 million', '2b', '40k', 'abc', '0'].map(parseEstimate), [
    1200,
    3.5e6,
    2e9,
    4e4,
    null,
    null,
  ])
  assert.equal(arrow({ lat: 0, lon: 0 }, { lat: 10, lon: 0 }), '↑')
  assert.equal(arrow({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }), '→')
})
