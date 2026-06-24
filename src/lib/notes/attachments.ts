import type { AttachmentKind, Screenshot, SpreadsheetPreview } from './types'

/** Markers in markdown: `[📎 id]` (new) or `[📷 id]` (legacy images). */
export const NOTE_ATTACHMENT_MARKER = /\[(?:📎|📷)\s*([^\]]+)\]/g

const SPREADSHEET_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/tab-separated-values',
])
const SPREADSHEET_EXT = /\.(xlsx|xls|csv|tsv)$/i

export function newAttachmentId(prefix = 'attach'): string {
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

export function attachmentDataUrl(shot: Screenshot): string {
  return `data:${shot.mimeType};base64,${shot.base64}`
}

/** @deprecated use attachmentDataUrl */
export const screenshotDataUrl = attachmentDataUrl

export function attachmentKindForFile(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) return 'image'
  if (SPREADSHEET_MIMES.has(file.type) || SPREADSHEET_EXT.test(file.name)) return 'spreadsheet'
  if (file.type === 'application/pdf') return 'document'
  return 'file'
}

export function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({ base64, mimeType: file.type || 'application/octet-stream' })
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/** @deprecated */
export const readImageFile = readFileAsBase64

const PREVIEW_MAX_ROWS = 40
const PREVIEW_MAX_COLS = 12

function trimGrid(headers: string[], rows: string[][]): SpreadsheetPreview {
  const h = headers.slice(0, PREVIEW_MAX_COLS)
  const r = rows.slice(0, PREVIEW_MAX_ROWS).map((row) => row.slice(0, PREVIEW_MAX_COLS))
  return {
    sheetName: 'Sheet1',
    headers: h,
    rows: r,
    totalRows: rows.length,
    totalCols: Math.max(headers.length, ...rows.map((x) => x.length), 0),
  }
}

function parseCsvText(text: string): SpreadsheetPreview {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  if (!lines.length) {
    return { sheetName: 'CSV', headers: [], rows: [], totalRows: 0, totalCols: 0 }
  }
  const split = (line: string) => {
    const out: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]!
      if (c === '"') {
        q = !q
        continue
      }
      if (c === ',' && !q) {
        out.push(cur.trim())
        cur = ''
        continue
      }
      cur += c
    }
    out.push(cur.trim())
    return out
  }
  const headers = split(lines[0]!)
  const rows = lines.slice(1).map(split)
  return trimGrid(headers, rows)
}

export async function parseSpreadsheetFile(file: File): Promise<SpreadsheetPreview | null> {
  if (file.type === 'text/csv' || /\.csv$/i.test(file.name)) {
    const text = await file.text()
    return { ...parseCsvText(text), sheetName: file.name.replace(/\.csv$/i, '') || 'CSV' }
  }

  try {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheetName = wb.SheetNames[0] ?? 'Sheet1'
    const sheet = wb.Sheets[sheetName]
    if (!sheet) return null
    const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as string[][]
    if (!raw.length) {
      return { sheetName, headers: [], rows: [], totalRows: 0, totalCols: 0 }
    }
    const headers = (raw[0] ?? []).map(String)
    const rows = raw.slice(1).map((r) => r.map(String))
    return { ...trimGrid(headers, rows), sheetName }
  } catch {
    return null
  }
}

export function spreadsheetPreviewText(preview: SpreadsheetPreview): string {
  const lines = [preview.headers.join('\t'), ...preview.rows.map((r) => r.join('\t'))]
  return `[Spreadsheet: ${preview.sheetName} (${preview.totalRows}×${preview.totalCols})]\n${lines.join('\n')}`
}

export async function fileToAttachment(file: File): Promise<Screenshot> {
  const kind = attachmentKindForFile(file)
  const { base64, mimeType } = await readFileAsBase64(file)
  const id = newAttachmentId(kind === 'image' ? 'screenshot' : kind)
  const attachment: Screenshot = { id, base64, mimeType, filename: file.name, kind }

  if (kind === 'spreadsheet') {
    const preview = await parseSpreadsheetFile(file)
    if (preview) attachment.preview = preview
  }

  if (kind === 'image') {
    attachment.display = { widthPx: 480, heightPx: 320 }
  } else if (kind === 'spreadsheet') {
    attachment.display = { widthPx: 560, heightPx: 280 }
  } else {
    attachment.display = { widthPx: 360, heightPx: 120 }
  }

  return attachment
}

export function filesFromClipboard(event: { clipboardData: DataTransfer | null }): File[] {
  const out: File[] = []
  const items = event.clipboardData?.items
  if (items) {
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) out.push(file)
      }
    }
  }
  const files = event.clipboardData?.files
  if (files?.length) {
    for (const file of files) {
      if (!out.some((f) => f.name === file.name && f.size === file.size)) out.push(file)
    }
  }
  return out
}

export function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt?.files?.length) return []
  return [...dt.files]
}

/** @deprecated */
export function imageFileFromClipboard(event: { clipboardData: DataTransfer | null }): File | null {
  return filesFromClipboard(event).find((f) => f.type.startsWith('image/')) ?? null
}

/** @deprecated */
export function imageFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  return filesFromDataTransfer(dt).filter((f) => f.type.startsWith('image/'))
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function approxBase64Bytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4)
}
