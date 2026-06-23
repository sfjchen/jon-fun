import type { Screenshot } from './types'

/** Legacy marker stored in markdown: `[📷 screenshot-123]` */
export const NOTE_ATTACHMENT_MARKER = /\[📷\s*([^\]]+)\]/g

export function newAttachmentId(prefix = 'screenshot'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function attachmentIdsInNotes(notes: string): string[] {
  const ids: string[] = []
  for (const m of notes.matchAll(NOTE_ATTACHMENT_MARKER)) {
    const id = m[1]?.trim()
    if (id) ids.push(id)
  }
  return ids
}

export function screenshotDataUrl(shot: Screenshot): string {
  return `data:${shot.mimeType};base64,${shot.base64}`
}

export function readImageFile(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({ base64, mimeType: file.type || 'image/png' })
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

/** Clipboard paste on macOS / browsers — image may be in items or files. */
export function imageFileFromClipboard(event: { clipboardData: DataTransfer | null }): File | null {
  const items = event.clipboardData?.items
  if (items) {
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) return file
      }
    }
  }
  const files = event.clipboardData?.files
  if (files?.length) {
    for (const file of files) {
      if (file.type.startsWith('image/')) return file
    }
  }
  return null
}

export function imageFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt?.files?.length) return []
  return [...dt.files].filter((f) => f.type.startsWith('image/'))
}
