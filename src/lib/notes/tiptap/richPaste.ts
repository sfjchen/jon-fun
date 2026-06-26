import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { filesFromClipboard } from '../attachments'
import { clipboardToEditorContent } from './clipboardConvert'

export function insertRichPasteContent(editor: Editor, html: string | null | undefined, plain: string): boolean {
  const blocks = clipboardToEditorContent(html, plain)
  if (!blocks?.length) return false
  return editor.chain().focus().insertContent(blocks).run()
}

/** Google Docs / Sheets / web HTML paste + plain-text bullet normalization. */
export const richPasteExtension = Extension.create({
  name: 'richPaste',
  priority: 1000,
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            if (filesFromClipboard(event).length) return false

            const html = event.clipboardData?.getData('text/html') ?? ''
            const plain = event.clipboardData?.getData('text/plain') ?? ''
            if (!html.trim() && !plain.trim()) return false

            if (!insertRichPasteContent(editor, html, plain)) return false

            event.preventDefault()
            return true
          },
        },
      }),
    ]
  },
})
