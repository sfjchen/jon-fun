import { Extension } from '@tiptap/core'
import { DEFAULT_TABLE_COLS, DEFAULT_TABLE_ROWS } from './tableUtils'

/** Notes table keyboard shortcuts (Tab/Shift-Tab handled by TableKit). */
export const tableKeymap = Extension.create({
  name: 'notesTableKeymap',
  addKeyboardShortcuts() {
    return {
      'Mod-Alt-t': () =>
        this.editor
          .chain()
          .focus()
          .insertTable({
            rows: DEFAULT_TABLE_ROWS,
            cols: DEFAULT_TABLE_COLS,
            withHeaderRow: true,
          })
          .run(),
      'Mod-Alt-T': () =>
        this.editor
          .chain()
          .focus()
          .insertTable({
            rows: DEFAULT_TABLE_ROWS,
            cols: DEFAULT_TABLE_COLS,
            withHeaderRow: true,
          })
          .run(),
    }
  },
})
