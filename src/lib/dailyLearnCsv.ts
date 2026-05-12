/**
 * RFC 4180-style CSV parse/format for 1 Sentence Everyday export/import (no browser APIs).
 */

export type DailyLearnCsvEntry = {
  date: string
  text: string
  updatedAt: string
}

/** Split CSV body into rows; supports quoted fields, commas, CRLF, escaped quotes (""). */
export function parseCsvToRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      if (text[i] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      continue
    }
    if (c === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i++
      continue
    }
    field += c
    i++
  }
  row.push(field)
  rows.push(row)
  return rows
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function dedupeByDatePreferLater(entries: DailyLearnCsvEntry[]): DailyLearnCsvEntry[] {
  const map = new Map<string, DailyLearnCsvEntry>()
  for (const e of entries) {
    const prev = map.get(e.date)
    if (!prev || new Date(e.updatedAt) >= new Date(prev.updatedAt)) map.set(e.date, e)
  }
  return [...map.values()]
}

/**
 * Parse app-exported (or compatible) CSV: header must include date + text;
 * updatedAt optional (defaults to import time per row).
 */
export function parseDailyLearnCsv(csvText: string): { entries: DailyLearnCsvEntry[]; error?: string } {
  const trimmed = csvText.replace(/^\uFEFF/, '').replace(/\s+$/, '')
  if (!trimmed) return { entries: [], error: 'CSV is empty' }
  const rows = parseCsvToRows(trimmed).filter((r) => r.some((c) => c.trim() !== ''))
  if (rows.length === 0) return { entries: [], error: 'CSV is empty' }

  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  const di = header.indexOf('date')
  const ti = header.indexOf('text')
  const ui = header.indexOf('updatedat')
  if (di === -1 || ti === -1) {
    return { entries: [], error: 'Header row must include date and text columns' }
  }

  const raw: DailyLearnCsvEntry[] = []
  const now = new Date().toISOString()
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!
    if (row.every((c) => c.trim() === '')) continue
    const date = (row[di] ?? '').trim()
    const text = row[ti] ?? ''
    const updatedRaw = ui >= 0 ? (row[ui] ?? '').trim() : ''
    const updatedAt = updatedRaw || now
    if (!DATE_RE.test(date)) {
      return {
        entries: [],
        error: `Invalid date "${date}" on data row ${r + 1} (expected YYYY-MM-DD)`,
      }
    }
    if (!text.trim()) continue
    raw.push({ date, text: text.trim(), updatedAt })
  }
  if (raw.length === 0) return { entries: [], error: 'No rows with non-empty text' }
  return { entries: dedupeByDatePreferLater(raw) }
}

function csvEscapeField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Same column order as legacy export; rows sorted newest date first (matches loadEntries order). */
export function formatDailyLearnCsv(entries: readonly DailyLearnCsvEntry[]): string {
  const sorted = [...entries].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
  const header = ['date', 'text', 'updatedAt'].map(csvEscapeField).join(',')
  const lines = sorted.map((e) => [e.date, e.text, e.updatedAt].map(csvEscapeField).join(','))
  return [header, ...lines].join('\n')
}
