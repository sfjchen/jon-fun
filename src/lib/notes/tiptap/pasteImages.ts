import type { Editor } from '@tiptap/core'
import { newAttachmentId, readImageFile } from '../attachments'

export async function insertNoteAttachment(
  editor: Editor,
  file: File,
  onScreenshotPaste: (id: string, base64: string, mimeType: string) => void,
): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null
  const { base64, mimeType } = await readImageFile(file)
  const id = newAttachmentId()
  onScreenshotPaste(id, base64, mimeType)
  editor
    .chain()
    .focus()
    .insertContent({ type: 'noteAttachment', attrs: { attachmentId: id } })
    .run()
  return id
}

export async function insertNoteAttachmentsFromFiles(
  editor: Editor,
  files: File[],
  onScreenshotPaste: (id: string, base64: string, mimeType: string) => void,
): Promise<string[]> {
  const ids: string[] = []
  for (const file of files) {
    const id = await insertNoteAttachment(editor, file, onScreenshotPaste)
    if (id) ids.push(id)
  }
  return ids
}
