import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { filesFromClipboard, filesFromDataTransfer } from '../attachments'
import { insertNoteAttachmentsFromFiles } from './pasteFiles'
import type { NoteAttachmentStorage } from './noteAttachment'

/** Paste / drop files (images, Excel, PDF, etc.) into the editor. */
export const attachmentPasteExtension = Extension.create({
  name: 'attachmentPaste',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const storage = editor.storage.noteAttachment as NoteAttachmentStorage
            const onAdd = storage.onAdd
            if (!onAdd) return false

            const files = filesFromClipboard(event)
            if (!files.length) return false

            event.preventDefault()
            void insertNoteAttachmentsFromFiles(editor, files, onAdd)
            return true
          },
          handleDrop(_view, event) {
            const storage = editor.storage.noteAttachment as NoteAttachmentStorage
            const onAdd = storage.onAdd
            if (!onAdd) return false

            const files = filesFromDataTransfer(event.dataTransfer)
            if (!files.length) return false

            event.preventDefault()
            const coords = { left: event.clientX, top: event.clientY }
            const pos = editor.view.posAtCoords(coords)?.pos
            if (pos != null) editor.chain().focus().setTextSelection(pos).run()
            void insertNoteAttachmentsFromFiles(editor, files, onAdd)
            return true
          },
        },
      }),
    ]
  },
})
