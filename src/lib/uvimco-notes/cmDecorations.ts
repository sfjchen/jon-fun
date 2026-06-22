import { Decoration, EditorView, ViewPlugin, placeholder, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { detectTriggers } from './triggerParser'

const triggerMark = Decoration.mark({ class: 'cm-trigger-term' })
const triggerActive = Decoration.mark({ class: 'cm-trigger-term cm-trigger-active' })
const actionLine = Decoration.line({ class: 'cm-action-line' })
const keyLine = Decoration.line({ class: 'cm-key-line' })
const approxLine = Decoration.line({ class: 'cm-approx-line' })

function buildDecorations(view: EditorView, activeQuery: string | null): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const text = doc.toString()

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const trimmed = line.text.trimStart()
    if (trimmed.startsWith('>')) builder.add(line.from, line.from, actionLine)
    else if (trimmed.startsWith('*')) builder.add(line.from, line.from, keyLine)
    else if (trimmed.startsWith('~')) builder.add(line.from, line.from, approxLine)
  }

  const termRe = /(?:^|\s)(\?\[[^\]]+\]|\?\w+)/g
  let m: RegExpExecArray | null
  while ((m = termRe.exec(text)) !== null) {
    const full = m[1]!
    const start = m.index + m[0].length - full.length
    const end = start + full.length
    const inner = full.startsWith('?[') ? full.slice(2, -1) : full.slice(1)
    const deco = activeQuery && inner === activeQuery ? triggerActive : triggerMark
    builder.add(start, end, deco)
  }

  return builder.finish()
}

export function decorationPlugin(activeQuery: string | null) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, activeQuery)
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) {
          this.decorations = buildDecorations(u.view, activeQuery)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

export function triggerPlugin(
  onTrigger: (type: 'word' | 'line', query: string, context: string) => void,
  lastFiredRef: { current: string | null },
) {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.check(view)
      }
      update(u: ViewUpdate) {
        if (u.docChanged) this.check(u.view)
      }
      check(view: EditorView) {
        const pos = view.state.selection.main.head
        const text = view.state.doc.toString()
        const result = detectTriggers(text, pos, lastFiredRef.current)
        if (!result) return
        lastFiredRef.current = result.query
        const lines = text.slice(0, pos).split('\n')
        const context = lines.slice(-15).join('\n')
        onTrigger(result.type, result.query, context)
      }
    },
  )
}

export const editorPlaceholder = placeholder(
  'Start typing. ?term for AI lookup · line ending with ? · > todo · * highlight · paste screenshot',
)

export const uvimcoEditorTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--uv-bg-elevated)', height: '100%' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-lato), Lato, sans-serif' },
  '.cm-content': {
    fontFamily: 'var(--font-lato), Lato, sans-serif',
    fontSize: '16px',
    lineHeight: '1.75',
    caretColor: 'var(--uv-text-primary)',
    color: 'var(--uv-text-primary)',
    padding: '12px 0',
  },
  '.cm-line': { padding: '0 16px' },
  '.cm-placeholder': { color: 'var(--uv-text-muted)', fontStyle: 'normal' },
  '.cm-gutters': { display: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--uv-accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(35, 131, 226, 0.18) !important',
  },
})
