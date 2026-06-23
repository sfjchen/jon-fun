import { Extension } from '@tiptap/core'
import { indentBlocks, pastePlainText, wrapHighlightSelection } from './editorCommands'

/** Tab indent, plain paste, and *-wrap highlight shortcuts. */
export const notesEditingExtension = Extension.create({
  name: 'notesEditing',
  addKeyboardShortcuts() {
    const wrapStar = () => wrapHighlightSelection(this.editor)
    return {
      Tab: () => indentBlocks(this.editor, false),
      'Shift-Tab': () => indentBlocks(this.editor, true),
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
