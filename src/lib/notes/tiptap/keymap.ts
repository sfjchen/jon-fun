import { Extension } from '@tiptap/core'

/** Google Docs-style shortcuts for the Notes editor. */
export const notesKeymap = Extension.create({
  name: 'notesKeymap',
  addKeyboardShortcuts() {
    const bold = () => this.editor.commands.toggleBold()
    const italic = () => this.editor.commands.toggleItalic()
    const underline = () => this.editor.commands.toggleUnderline()
    const ordered = () => this.editor.commands.toggleOrderedList()
    const bullet = () => this.editor.commands.toggleBulletList()
    return {
      'Mod-b': bold,
      'Ctrl-b': bold,
      'Mod-i': italic,
      'Ctrl-i': italic,
      'Mod-u': underline,
      'Ctrl-u': underline,
      'Mod-Shift-7': ordered,
      'Ctrl-Shift-7': ordered,
      'Mod-Shift-8': bullet,
      'Ctrl-Shift-8': bullet,
    }
  },
})
