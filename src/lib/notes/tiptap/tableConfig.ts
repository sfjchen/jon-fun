import { TableKit } from '@tiptap/extension-table/kit'

/** Tiptap TableKit — resizable tables with markdown round-trip. */
export const notesTableKit = TableKit.configure({
  table: {
    resizable: true,
    lastColumnResizable: true,
    renderWrapper: true,
    cellMinWidth: 48,
    allowTableNodeSelection: true,
  },
})
