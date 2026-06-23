import { dashIndentLevel } from '../src/lib/notes/tiptap/dashList'
import { wrapLinesWithHighlight } from '../src/lib/notes/tiptap/editorCommands'
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

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll editor helper checks passed.')
