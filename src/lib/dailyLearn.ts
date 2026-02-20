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
const SYNC_KEY = 'daily_learn_sync_key'

function toLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Capitalize first letter of text (handles leading whitespace, empty string). */
export function capitalizeFirst(text: string): string {
  const t = text.trim()
  if (!t) return text
  const i = text.search(/\S/)
  if (i === -1) return text
  return text.slice(0, i) + text[i]!.toUpperCase() + text.slice(i + 1)
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

/** Day resets at 5 AM in the device's local timezone (not midnight). Call client-side only. */
export function getTodayDate(): string {
  const now = new Date()
  if (now.getHours() < 5) {
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

/** Sync key links devices; when set, both use same user_id for Supabase. */
export function getSyncKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(SYNC_KEY) ?? ''
}

export function setSyncKey(key: string): void {
  if (typeof window === 'undefined') return
  if (key.trim()) localStorage.setItem(SYNC_KEY, key.trim())
  else localStorage.removeItem(SYNC_KEY)
}

/** Effective user_id for API: sync key if set, else device user_id. */
export function getEffectiveUserId(): string {
  const sk = getSyncKey()
  return sk ? sk : getOrCreateUserId()
}

/** Merge entries by date, keep latest updatedAt. Normalize text to capitalized first letter. */
function mergeEntries(local: DailyLearnEntry[], remote: DailyLearnEntry[]): DailyLearnEntry[] {
  const byDate = new Map<string, DailyLearnEntry>()
  for (const e of [...local, ...remote]) {
    const normalized = { ...e, text: capitalizeFirst(e.text) }
    const existing = byDate.get(e.date)
    if (!existing || new Date(e.updatedAt) > new Date(existing.updatedAt)) {
      byDate.set(e.date, normalized)
    }
  }
  return [...byDate.values()].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
}

/** Fetch entries from server for effective user_id. */
export async function fetchEntriesFromServer(): Promise<DailyLearnEntry[]> {
  const userId = getEffectiveUserId()
  const res = await fetch(`/api/daily-learn/entries?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return []
  const data = (await res.json()) as { entries?: DailyLearnEntry[] }
  return Array.isArray(data.entries) ? data.entries : []
}

/** Delete entry from server. */
export async function deleteEntryFromServer(date: string): Promise<boolean> {
  const userId = getEffectiveUserId()
  const res = await fetch(
    `/api/daily-learn/entries?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`,
    { method: 'DELETE' }
  )
  return res.ok
}

/** Push entries to server. */
export async function pushEntriesToServer(entries: DailyLearnEntry[]): Promise<boolean> {
  const userId = getEffectiveUserId()
  const res = await fetch('/api/daily-learn/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      entries: entries.map((e) => ({ date: e.date, text: capitalizeFirst(e.text) })),
    }),
  })
  return res.ok
}

/** Sync: fetch from server, merge with local, save local, push merged. Returns merged entries. */
export async function syncWithServer(): Promise<DailyLearnEntry[]> {
  if (typeof window === 'undefined') return loadEntries()
  const local = loadEntries()
  const remote = await fetchEntriesFromServer()
  const merged = mergeEntries(local, remote)
  const mergedJson = JSON.stringify(merged)
  if (localStorage.getItem(ENTRIES_KEY) !== mergedJson) {
    localStorage.setItem(ENTRIES_KEY, mergedJson)
  }
  await pushEntriesToServer(merged)
  return merged
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
  const text = entry.text.trim()
  if (!text) {
    const filtered = entries.filter((e) => e.date !== entry.date)
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered))
    deleteEntryFromServer(entry.date).catch(() => {})
    return
  }
  const updated: DailyLearnEntry = {
    ...entry,
    text: capitalizeFirst(text),
    updatedAt: new Date().toISOString(),
  }
  const idx = entries.findIndex((e) => e.date === entry.date)
  if (idx >= 0) entries[idx] = updated
  else entries.push(updated)
  entries.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
  pushEntriesToServer(entries).catch(() => {})
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
  return entries.map((e) => `${e.date}: ${capitalizeFirst(e.text)}`).join('\n')
}

export function exportAsJson(): string {
  const entries = loadEntries().map((e) => ({ ...e, text: capitalizeFirst(e.text) }))
  return JSON.stringify(entries, null, 2)
}
