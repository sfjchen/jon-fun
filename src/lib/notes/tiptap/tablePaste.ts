import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { filesFromClipboard } from '../attachments'
import { gridToTableContent, looksLikeTabularText, parseTabularText } from './tableUtils'

export function insertTableFromGrid(editor: Editor, grid: string[][], withHeaderRow = false): boolean {
  if (!grid.length) return false
  return editor.chain().focus().insertContent(gridToTableContent(grid, withHeaderRow)).run()
}

/** Paste tab-separated / CSV clipboard text as an inline table (Excel copy). */
export const tablePasteExtension = Extension.create({
  name: 'tablePaste',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            if (filesFromClipboard(event).length) return false

            const text = event.clipboardData?.getData('text/plain') ?? ''
            if (!looksLikeTabularText(text)) return false

            event.preventDefault()
            const grid = parseTabularText(text)
            insertTableFromGrid(editor, grid, false)
            return true
          },
        },
      }),
    ]
  },
})
