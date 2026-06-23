import { Extension } from '@tiptap/core'

/** Google Docs-style shortcuts for the Notes editor. */
export const notesKeymap = Extension.create({
  name: 'notesKeymap',
  addKeyboardShortcuts() {
    const bold = () => this.editor.commands.toggleBold()
    const italic = () => this.editor.commands.toggleItalic()
    const underline = () => this.editor.commands.toggleUnderline()
    return {
      'Mod-b': bold,
      'Ctrl-b': bold,
      'Mod-i': italic,
      'Ctrl-i': italic,
      'Mod-u': underline,
      'Ctrl-u': underline,
    }
  },
})
