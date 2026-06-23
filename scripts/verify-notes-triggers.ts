/**
 * Verify Notes trigger detection (no browser).
 *   npm run verify:notes-triggers
 */
import { detectLineTriggers, countShorthandFlags } from '../src/lib/notes/triggerParser'
import { postprocessTodoMarkdown, preprocessTodoMarkdown, mergeTodoLinesIntoMarkdown } from '../src/lib/notes/tiptap/editorCoords'
import { collectTodos } from '../src/lib/notes/rollup'
import { termsFromLookup } from '../src/lib/notes/glossary'
import type { NoteSession } from '../src/lib/notes/types'

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

const todoMd = '> follow up IC\nplain line'
const escaped = preprocessTodoMarkdown(todoMd)
if (!escaped.includes('\\>')) {
  failed++
  console.error('✗ preprocessTodoMarkdown should escape >')
} else {
  console.log('✓ preprocessTodoMarkdown')
}

const restored = postprocessTodoMarkdown(escaped)
if (restored !== todoMd) {
  failed++
  console.error('✗ postprocessTodoMarkdown round-trip', restored)
} else {
  console.log('✓ postprocessTodoMarkdown round-trip')
}

const merged = mergeTodoLinesIntoMarkdown('> follow up IC\nplain', 'follow up IC\nplain')
if (!merged.startsWith('> follow up IC')) {
  failed++
  console.error('✗ mergeTodoLinesIntoMarkdown', merged)
} else {
  console.log('✓ mergeTodoLinesIntoMarkdown')
}

const mergedSuffix = mergeTodoLinesIntoMarkdown('follow up IC memo>', 'follow up IC memo')
if (mergedSuffix !== 'follow up IC memo>') {
  failed++
  console.error('✗ mergeTodoLinesIntoMarkdown suffix todo', mergedSuffix)
} else {
  console.log('✓ mergeTodoLinesIntoMarkdown suffix todo')
}

const suffixTodos = collectTodos([
  {
    id: '2',
    title: 'Suffix',
    notes: 'follow up IC memo>',
    tags: [],
    lookups: [],
    screenshots: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies NoteSession,
])
if (suffixTodos.length !== 1 || suffixTodos[0]!.text !== 'follow up IC memo') {
  failed++
  console.error('✗ collectTodos from suffix > line', suffixTodos)
} else {
  console.log('✓ collectTodos from suffix > line')
}

const todos = collectTodos([
  {
    id: '1',
    title: 'Test',
    notes: '> follow up IC memo',
    tags: [],
    lookups: [],
    screenshots: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies NoteSession,
])
if (todos.length !== 1 || todos[0]!.text !== 'follow up IC memo') {
  failed++
  console.error('✗ collectTodos from > line', todos)
} else {
  console.log('✓ collectTodos from > line')
}

const vsTerms = termsFromLookup({
  id: 'x',
  type: 'line',
  query: 'mv vs dan',
  context: '',
  conversation: [],
  triggeredAt: new Date().toISOString(),
})
if (vsTerms.length !== 2 || vsTerms[0] !== 'mv' || vsTerms[1] !== 'dan') {
  failed++
  console.error('✗ termsFromLookup splits vs', vsTerms)
} else {
  console.log('✓ termsFromLookup splits vs')
}

const skipTerms = termsFromLookup({
  id: 'y',
  type: 'line',
  query: 'stored test',
  context: '',
  conversation: [],
  triggeredAt: new Date().toISOString(),
})
if (skipTerms.length !== 0) {
  failed++
  console.error('✗ termsFromLookup skips test noise', skipTerms)
} else {
  console.log('✓ termsFromLookup skips test noise')
}

if (failed > 0) {
  console.error(`\n${failed} trigger check(s) failed`)
  process.exit(1)
}
console.log('\nAll trigger checks passed.')
