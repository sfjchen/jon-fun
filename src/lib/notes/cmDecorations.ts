import { Decoration, EditorView, ViewPlugin, placeholder, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { DEBOUNCE_MS, detectLineTriggers } from './triggerParser'
import type { TriggerType } from './types'

const triggerMark = Decoration.mark({ class: 'cm-trigger-line' })
const triggerActive = Decoration.mark({ class: 'cm-trigger-line cm-trigger-active' })
const actionLine = Decoration.line({ class: 'cm-action-line' })
const keyLine = Decoration.line({ class: 'cm-key-line' })
const approxLine = Decoration.line({ class: 'cm-approx-line' })

function buildDecorations(view: EditorView, activeQuery: string | null): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const trimmed = line.text.trimStart()
    if (trimmed.startsWith('>')) builder.add(line.from, line.from, actionLine)
    else if (trimmed.startsWith('*')) builder.add(line.from, line.from, keyLine)
    else if (trimmed.startsWith('~')) builder.add(line.from, line.from, approxLine)

    const endMatch = trimmed.match(/(\?\?|\?)$/)
    if (endMatch) {
      const start = line.from + line.text.length - endMatch[0]!.length
      const end = line.from + line.text.length
      const query = trimmed.slice(0, -endMatch[0]!.length).trim()
      const deco = activeQuery && query === activeQuery ? triggerActive : triggerMark
      builder.add(start, end, deco)
    }
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
  onTrigger: (type: TriggerType, query: string, context: string) => void,
  lastFiredRef: { current: string | null },
) {
  return ViewPlugin.fromClass(
    class {
      debounceTimer: ReturnType<typeof setTimeout> | null = null
      lastPos = -1

      constructor(view: EditorView) {
        this.scheduleCheck(view)
      }

      update(u: ViewUpdate) {
        if (u.docChanged) this.scheduleCheck(u.view)
      }

      scheduleCheck(view: EditorView) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null
          this.check(view)
        }, DEBOUNCE_MS)
      }

      check(view: EditorView) {
        const pos = view.state.selection.main.head
        const text = view.state.doc.toString()
        const result = detectLineTriggers(text, pos, lastFiredRef.current)
        if (!result) return
        lastFiredRef.current = result.fireKey
        onTrigger(result.type, result.query, result.context)
      }

      destroy() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
      }
    },
  )
}

export const editorPlaceholder = placeholder(
  'Start typing. End a line with ? for AI · ?? for section · > todo · * highlight',
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
  '.cm-trigger-line': { color: 'var(--uv-accent-strong)', fontWeight: 500 },
  '.cm-trigger-active': { backgroundColor: 'var(--uv-accent-dim)' },
})
