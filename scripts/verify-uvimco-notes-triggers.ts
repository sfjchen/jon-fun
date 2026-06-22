/**
 * Verify UVIMCO Notes trigger detection (no browser).
 *   npm run verify:uvimco-notes-triggers
 */
import { detectTriggers, countShorthandFlags } from '../src/lib/uvimco-notes/triggerParser'

type Case = {
  label: string
  text: string
  pos: number
  last: string | null
  expect: { type: 'word' | 'line'; query: string } | null
}

const cases: Case[] = [
  {
    label: 'space after ?term mid-line',
    text: 'fund review ?DPI ',
    pos: 17,
    last: null,
    expect: { type: 'word', query: 'DPI' },
  },
  {
    label: 'Enter after ?term on previous line',
    text: 'review ?MOIC\n',
    pos: 13,
    last: null,
    expect: { type: 'word', query: 'MOIC' },
  },
  {
    label: 'hyphenated ?LP-GP + space',
    text: '?LP-GP ',
    pos: 7,
    last: null,
    expect: { type: 'word', query: 'LP-GP' },
  },
  {
    label: 'bracket phrase ?[basis risk] + space',
    text: 'flag ?[basis risk] ',
    pos: 19,
    last: null,
    expect: { type: 'word', query: 'basis risk' },
  },
  {
    label: 'line? on Enter',
    text: 'LTP underweight this quarter?\n',
    pos: 30,
    last: null,
    expect: { type: 'line', query: 'LTP underweight this quarter' },
  },
  {
    label: 'dedupe same query',
    text: 'review ?DPI ',
    pos: 13,
    last: 'DPI',
    expect: null,
  },
  {
    label: 'no trigger without delimiter',
    text: 'review ?MOIC',
    pos: 12,
    last: null,
    expect: null,
  },
]

let failed = 0
for (const c of cases) {
  const got = detectTriggers(c.text, c.pos, c.last)
  const ok =
    (c.expect === null && got === null) ||
    (c.expect !== null &&
      got !== null &&
      got.type === c.expect.type &&
      got.query === c.expect.query)
  if (!ok) {
    failed++
    console.error('✗', c.label)
    console.error('  expected', c.expect, 'got', got)
  } else {
    console.log('✓', c.label)
  }
}

const flags = countShorthandFlags('boss ?DPI\n>todo\n*key')
if (flags.flags !== 1 || flags.actions !== 1) {
  failed++
  console.error('✗ countShorthandFlags', flags)
} else {
  console.log('✓ countShorthandFlags')
}

if (failed > 0) {
  console.error(`\n${failed} trigger check(s) failed`)
  process.exit(1)
}
console.log('\nAll trigger checks passed.')
