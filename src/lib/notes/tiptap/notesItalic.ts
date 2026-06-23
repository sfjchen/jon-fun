import Italic from '@tiptap/extension-italic'

/** Italic via toolbar/shortcuts only — do not steal `*highlight*` shorthand. */
export const NotesItalic = Italic.extend({
  addInputRules() {
    return []
  },
  addPasteRules() {
    return []
  },
})
