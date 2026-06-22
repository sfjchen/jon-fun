/**
 * Verify Notes trigger detection (no browser).
 *   npm run verify:uvimco-notes-triggers
 */
import { detectLineTriggers, countShorthandFlags } from '../src/lib/uvimco-notes/triggerParser'

type Case = {
  label: string
  text: string
  pos: number
  last: string | null
  expect: { type: 'line' | 'section'; query: string } | null
}

const cases: Case[] = [
  {
    label: 'line ending with ?',
    text: 'fund DPI ratio?',
    pos: 15,
    last: null,
    expect: { type: 'line', query: 'fund DPI ratio' },
  },
  {
    label: 'section ending with ??',
    text: 'LP stakes\nGP fee??',
    pos: 18,
    last: null,
    expect: { type: 'section', query: 'GP fee' },
  },
  {
    label: 'dedupe same fireKey',
    text: 'fund DPI ratio?',
    pos: 15,
    last: 'line:fund DPI ratio:0',
    expect: null,
  },
  {
    label: 'no trigger mid-line without ?',
    text: 'fund DPI ratio',
    pos: 14,
    last: null,
    expect: null,
  },
  {
    label: 'single ? not ?? for line mode',
    text: 'what is MOIC?',
    pos: 13,
    last: null,
    expect: { type: 'line', query: 'what is MOIC' },
  },
]

let failed = 0
for (const c of cases) {
  const got = detectLineTriggers(c.text, c.pos, c.last)
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

const flags = countShorthandFlags('boss line?\n>todo\n*key')
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
