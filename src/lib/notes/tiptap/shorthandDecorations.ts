import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'
import { highlightRanges, parseTodoLine } from '../shorthand'
import { isArchivedTodoLine, parseActiveTodoLine } from '../todoLines'

function buildDecorations(doc: PmNode, activeQuery: string | null): DecorationSet {
  const decos: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return

    const lineText = node.textContent
    const trimmed = lineText.trimStart()

    if (isArchivedTodoLine(lineText)) {
      decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'tiptap-action-line tiptap-action-done' }))
    } else if (parseActiveTodoLine(lineText)) {
      decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'tiptap-action-line' }))
    }

    for (const { from, to } of highlightRanges(lineText)) {
      decos.push(
        Decoration.inline(pos + 1 + from, pos + 1 + to, { class: 'tiptap-highlight-span' }),
      )
    }

    const endMatch = trimmed.match(/(\?\?|\?)$/)
    if (endMatch) {
      const query = trimmed.slice(0, -endMatch[0]!.length).trim()
      const start = pos + 1 + lineText.length - endMatch[0]!.length
      const end = pos + 1 + lineText.length
      const cls =
        activeQuery && query === activeQuery ? 'tiptap-trigger-line tiptap-trigger-active' : 'tiptap-trigger-line'
      decos.push(Decoration.inline(start, end, { class: cls }))
    }
  })

  return DecorationSet.create(doc, decos)
}

export { buildDecorations }

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const shorthandDecorationsKey = new PluginKey('notesShorthandDecorations')

export function createShorthandDecorationsExtension(getActiveQuery: () => string | null) {
  return Extension.create({
    name: 'notesShorthandDecorations',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: shorthandDecorationsKey,
          state: {
            init(_, { doc }) {
              return buildDecorations(doc, getActiveQuery())
            },
            apply(_tr, _old, _oldState, newState) {
              return buildDecorations(newState.doc, getActiveQuery())
            },
          },
          props: {
            decorations(state) {
              return this.getState(state)
            },
          },
        }),
      ]
    },
  })
}

export function refreshShorthandDecorations(editor: import('@tiptap/core').Editor): void {
  editor.view.dispatch(editor.state.tr.setMeta('refreshDecorations', true))
}
