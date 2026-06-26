import {
  collapseRedundantBlankBlocks,
  looksLikeBulletListText,
  normalizePlainPasteText,
} from '../src/lib/notes/tiptap/clipboardConvert'
import { bullettizeLines, wrapLinesWithHighlight } from '../src/lib/notes/tiptap/editorCommands'
import { dashIndentLevel, indentDashLineText } from '../src/lib/notes/tiptap/dashList'
import { normalizeNotesMarkdown } from '../src/lib/notes/tiptap/markdownNormalize'

let failed = 0

function ok(name: string, cond: boolean) {
  if (cond) console.log(`✓ ${name}`)
  else {
    console.error(`✗ ${name}`)
    failed++
  }
}

ok('dash indent level 0 spaces', dashIndentLevel('') === 1)
ok('dash indent level 2 spaces', dashIndentLevel('  ') === 2)
ok('dash indent level 4 spaces', dashIndentLevel('    ') === 3)
ok('normalize strips trailing newlines', normalizeNotesMarkdown('a\n\n') === 'a')
ok('wrap highlight single line', wrapLinesWithHighlight('hello') === '*hello*')
ok('wrap highlight keeps indent', wrapLinesWithHighlight('  item') === '  *item*')
ok('wrap highlight skips wrapped', wrapLinesWithHighlight('*done*') === '*done*')
ok('wrap highlight multiline', wrapLinesWithHighlight('a\nb') === '*a*\n*b*')
ok(
  'normalize plain unicode bullets',
  normalizePlainPasteText('• one\n  • nested') === '- one\n  - nested',
)
ok('normalize plain skips dash lines', normalizePlainPasteText('- already\nplain') === null)
ok('bullettize plain lines', bullettizeLines('one\n  two') === '- one\n  - two')
ok('bullettize skips existing dash', bullettizeLines('- done') === '- done')
ok('indent dash line', indentDashLineText('- a', false) === '  - a')
ok('outdent dash line', indentDashLineText('  - a', true) === '- a')
ok('outdent dash at root stays bullet', indentDashLineText('- a', true) === '- a')
ok('bullet list text detected', looksLikeBulletListText('• one\n\t• two'))
ok('spreadsheet tabs not bullet list', !looksLikeBulletListText('A\tB\nC\tD'))
ok(
  'collapse mixed blank run to one',
  collapseRedundantBlankBlocks([
    { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
    { type: 'paragraph' },
    { type: 'paragraph', content: [{ type: 'hardBreak' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
  ]).filter((b) => b.type === 'paragraph' && !b.content?.length).length === 1,
)
ok(
  'preserve two intentional empty paragraphs',
  collapseRedundantBlankBlocks([
    { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
    { type: 'paragraph' },
    { type: 'paragraph' },
    { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
  ]).filter((b) => b.type === 'paragraph' && !b.content?.length).length === 2,
)

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll editor helper checks passed.')
