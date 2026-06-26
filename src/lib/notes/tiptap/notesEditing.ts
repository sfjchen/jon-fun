import { Extension } from '@tiptap/core'
import { bullettizeSelection, indentBlocks, pastePlainText, wrapHighlightSelection } from './editorCommands'

/** Tab indent, plain paste, *-wrap highlight, and "-" bullettize shortcuts. */
export const notesEditingExtension = Extension.create({
  name: 'notesEditing',
  addKeyboardShortcuts() {
    const wrapStar = () => wrapHighlightSelection(this.editor)
    const bulletDash = () => {
      if (!this.editor.state.selection.empty) return bullettizeSelection(this.editor)
      return false
    }
    return {
      Tab: () => indentBlocks(this.editor, false),
      'Shift-Tab': () => indentBlocks(this.editor, true),
      '-': bulletDash,
      '*': wrapStar,
      'Shift-8': wrapStar,
      'Mod-Shift-v': () => {
        void pastePlainText(this.editor)
        return true
      },
      'Ctrl-Shift-v': () => {
        void pastePlainText(this.editor)
        return true
      },
    }
  },
})
