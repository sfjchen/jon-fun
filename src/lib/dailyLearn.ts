/**
 * 1 Sentence Everyday – localStorage utilities
 * One entry per calendar day (upsert by date)
 */

export interface DailyLearnEntry {
  date: string // 'YYYY-MM-DD'
  text: string
  updatedAt: string // ISO timestamp
}

export interface DailyLearnCounts {
  total: number
  thisWeek: number
  thisMonth: number
}

const USER_ID_KEY = 'daily_learn_user_id'
const ENTRIES_KEY = 'daily_learn_entries'

function toLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD as local date (avoids UTC midnight shifting date behind) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

function genUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Day resets at 3 AM local (not midnight) */
export function getTodayDate(): string {
  const now = new Date()
  if (now.getHours() < 3) {
    const prev = new Date(now)
    prev.setDate(prev.getDate() - 1)
    return toLocalYYYYMMDD(prev)
  }
  return toLocalYYYYMMDD(now)
}

export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = genUuid()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

export function loadEntries(): DailyLearnEntry[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(ENTRIES_KEY)
  if (!stored) return []
  try {
    const arr = JSON.parse(stored) as DailyLearnEntry[]
    return Array.isArray(arr)
      ? [...arr].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
      : []
  } catch {
    return []
  }
}

export function saveEntry(entry: { date: string; text: string }): void {
  if (typeof window === 'undefined') return
  const entries = loadEntries()
  const updated: DailyLearnEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
  }
  const idx = entries.findIndex((e) => e.date === entry.date)
  if (idx >= 0) entries[idx] = updated
  else entries.push(updated)
  entries.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
}

export function getEntryByDate(date: string): DailyLearnEntry | undefined {
  return loadEntries().find((e) => e.date === date)
}

function getWeekStart(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d)
  mon.setDate(diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

export function getCounts(): DailyLearnCounts {
  const entries = loadEntries()
  const now = new Date()
  const weekStart = getWeekStart(now)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  let thisWeek = 0
  let thisMonth = 0
  for (const e of entries) {
    const ed = parseLocalDate(e.date)
    if (ed >= weekStart) thisWeek++
    if (ed >= monthStart) thisMonth++
  }
  return { total: entries.length, thisWeek, thisMonth }
}

export function getCalendarData(): Set<string> {
  const entries = loadEntries()
  return new Set(entries.map((e) => e.date))
}

export function exportAsText(): string {
  const entries = loadEntries()
  return entries.map((e) => `${e.date}: ${e.text}`).join('\n')
}

export function exportAsJson(): string {
  return JSON.stringify(loadEntries(), null, 2)
}
