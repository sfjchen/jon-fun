import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** Lines starting with optional spaces + "- " get visual indent; dash stays in text. */
const DASH_LINE = /^(\s*)- (.*)$/

export function dashIndentLevel(leadingSpaces: string): number {
  return Math.floor(leadingSpaces.length / 2) + 1
}

function dashDecorations(doc: import('@tiptap/pm/model').Node): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return
    const m = node.textContent.match(DASH_LINE)
    if (!m) return
    const level = dashIndentLevel(m[1] ?? '')
    decos.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: 'notes-dash-line',
        'data-dash-indent': String(level),
      }),
    )
  })
  return DecorationSet.create(doc, decos)
}

const dashListKey = new PluginKey('notesDashList')

export const dashListExtension = Extension.create({
  name: 'notesDashList',
  addProseMirrorPlugins() {
    const ed = this.editor
    return [
      new Plugin({
        key: dashListKey,
        state: {
          init(_, { doc }) {
            return dashDecorations(doc)
          },
          apply(tr, _old, _oldState, newState) {
            return dashDecorations(newState.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
          handleKeyDown(view, event) {
            if (event.key !== 'Enter' && event.key !== 'Backspace') return false

            const { state } = view
            const { $from, empty } = state.selection
            if (!$from.parent.isTextblock) return false

            const text = $from.parent.textContent
            const m = text.match(DASH_LINE)
            if (!m) return false

            const leading = m[1] ?? ''
            const body = m[2] ?? ''
            const dashPrefixLen = leading.length + 2

            if (event.key === 'Enter') {
              event.preventDefault()
              ed.chain().focus().splitBlock().insertContent(`${leading}- `).run()
              return true
            }

            if (event.key === 'Backspace' && empty) {
              const offset = $from.parentOffset
              if (offset > dashPrefixLen) return false

              if (body.length === 0 && offset === dashPrefixLen) {
                event.preventDefault()
                const from = $from.start()
                const tr = state.tr.delete(from, from + dashPrefixLen)
                tr.setSelection(TextSelection.near(tr.doc.resolve(from)))
                view.dispatch(tr)
                return true
              }

              if (offset === 0) {
                return false
              }

              if (offset <= dashPrefixLen) {
                event.preventDefault()
                const from = $from.start()
                const tr = state.tr.delete(from, from + offset)
                tr.setSelection(TextSelection.near(tr.doc.resolve(from)))
                view.dispatch(tr)
                return true
              }
            }

            return false
          },
        },
      }),
    ]
  },
})
