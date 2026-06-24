import type { Editor } from '@tiptap/core'
import { fileToAttachment } from '../attachments'
import type { Screenshot } from '../types'

export async function insertNoteAttachmentFromFile(
  editor: Editor,
  file: File,
  onAdd: (attachment: Screenshot) => void,
): Promise<string | null> {
  try {
    const attachment = await fileToAttachment(file)
    onAdd(attachment)
    editor
      .chain()
      .focus()
      .insertContent({ type: 'noteAttachment', attrs: { attachmentId: attachment.id } })
      .run()
    return attachment.id
  } catch {
    return null
  }
}

export async function insertNoteAttachmentsFromFiles(
  editor: Editor,
  files: File[],
  onAdd: (attachment: Screenshot) => void,
): Promise<string[]> {
  const ids: string[] = []
  for (const file of files) {
    const id = await insertNoteAttachmentFromFile(editor, file, onAdd)
    if (id) ids.push(id)
  }
  return ids
}

/** @deprecated */
export async function insertNoteAttachment(
  editor: Editor,
  file: File,
  onScreenshotPaste: (id: string, base64: string, mimeType: string) => void,
): Promise<string | null> {
  return insertNoteAttachmentFromFile(editor, file, (a) => onScreenshotPaste(a.id, a.base64, a.mimeType))
}
