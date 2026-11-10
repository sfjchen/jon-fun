/**
 * 1 Sentence Everyday – localStorage utilities and cross-device sync.
 * One entry per calendar day. Sync merges by date with the latest updatedAt winning, and deletions
 * travel as empty-text tombstones so a stale device cannot bring a deleted entry back.
 */

import { formatDailyLearnCsv, parseDailyLearnCsv } from './dailyLearnCsv'

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
/** localStorage key for entry JSON array — exported for E2E (End-to-End) and tooling */
export const DAILY_LEARN_ENTRIES_KEY = 'daily_learn_entries'
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

/** Sync password links devices; when set, both use same user_id for Supabase. */
export function getSyncKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(SYNC_KEY) ?? ''
}

export function setSyncKey(key: string): void {
  if (typeof window === 'undefined') return
  if (key.trim()) localStorage.setItem(SYNC_KEY, key.trim())
  else localStorage.removeItem(SYNC_KEY)
}

/** Effective user_id for API: sync password if set, else device user_id. */
export function getEffectiveUserId(): string {
  const sk = getSyncKey()
  return sk ? sk : getOrCreateUserId()
}

/** Sorts entries newest date first. */
function sortByDateDesc(entries: DailyLearnEntry[]): DailyLearnEntry[] {
  return entries.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
}

/** Parses an ISO timestamp to epoch ms, treating missing or invalid values as 0 so they never win a merge. */
function tsMs(iso: string | undefined): number {
  const t = Date.parse(iso ?? '')
  return Number.isNaN(t) ? 0 : t
}

/**
 * Merges entries by date, keeping the latest updatedAt (ties keep the first list's copy).
 * Empty-text entries are tombstones: they carry a deletion across devices instead of letting it resurrect.
 */
export function mergeEntries(local: DailyLearnEntry[], remote: DailyLearnEntry[]): DailyLearnEntry[] {
  const byDate = new Map<string, DailyLearnEntry>()
  for (const e of [...local, ...remote]) {
    const prev = byDate.get(e.date)
    if (!prev || tsMs(e.updatedAt) > tsMs(prev.updatedAt)) {
      byDate.set(e.date, { ...e, text: capitalizeFirst((e.text ?? '').trim()) })
    }
  }
  return sortByDateDesc([...byDate.values()])
}

/** Filters out tombstones, leaving the entries the UI (User Interface) shows. */
function visible(entries: DailyLearnEntry[]): DailyLearnEntry[] {
  return entries.filter((e) => e.text.trim().length > 0)
}

/** Reads every stored entry for the merge, tombstones included. */
function loadAllEntries(): DailyLearnEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const arr = JSON.parse(localStorage.getItem(DAILY_LEARN_ENTRIES_KEY) ?? '[]') as DailyLearnEntry[]
    return Array.isArray(arr) ? sortByDateDesc(arr.filter((e) => e && typeof e.date === 'string')) : []
  } catch {
    return []
  }
}

/** Fetches every row (tombstones included) for the effective user_id, or null when the request fails. */
async function fetchEntriesFromServer(): Promise<DailyLearnEntry[] | null> {
  try {
    const res = await fetch(`/api/daily-learn/entries?userId=${encodeURIComponent(getEffectiveUserId())}`)
    if (!res.ok) return null
    const data = (await res.json()) as { entries?: DailyLearnEntry[] }
    return Array.isArray(data.entries) ? data.entries : []
  } catch {
    return null
  }
}

const PUSH_RETRIES = 3
const RETRY_DELAY_MS = 500

/** Pushes entries with their own updatedAt so the server only overwrites rows older than each one. */
async function pushWithRetry(entries: DailyLearnEntry[]): Promise<boolean> {
  const body = JSON.stringify({
    userId: getEffectiveUserId(),
    entries: entries.map((e) => ({ date: e.date, text: e.text, updatedAt: e.updatedAt })),
  })
  for (let i = 0; i < PUSH_RETRIES; i++) {
    try {
      const res = await fetch('/api/daily-learn/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (res.ok) return true
    } catch {
      /* retries on network errors */
    }
    if (i < PUSH_RETRIES - 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
  }
  return false
}

/** True when textarea content differs from the saved entry for that date. */
export function isEntryTextDirty(localText: string, saved?: DailyLearnEntry): boolean {
  return localText.trim() !== (saved?.text ?? '').trim()
}

const IDS_URL = '/api/daily-learn/ids'
/** Resolves once this page load has restored and backed up its ids, shared so concurrent syncs wait on 1 run. */
let idsReady: Promise<void> | null = null

/**
 * Restores the sync password and device ID from the server cookie when localStorage has lost them (Safari erases
 * it after 7 days without a visit, which used to strand new entries under a fresh device ID), then backs up the
 * current ids. A failed attempt clears itself so the next sync retries.
 */
function ensureIds(): Promise<void> {
  idsReady ??= (async () => {
    if (!localStorage.getItem(USER_ID_KEY)) {
      const res = await fetch(IDS_URL)
      const saved = res.ok ? ((await res.json()) as { syncKey?: string; deviceId?: string }) : {}
      if (saved.deviceId) localStorage.setItem(USER_ID_KEY, saved.deviceId)
      if (saved.syncKey && !getSyncKey()) setSyncKey(saved.syncKey)
    }
    const res = await fetch(IDS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncKey: getSyncKey(), deviceId: getOrCreateUserId() }),
    })
    if (!res.ok) throw new Error('ids backup failed')
  })().catch(() => {
    idsReady = null
  })
  return idsReady
}

/**
 * Fetches from the server, merges with local, saves local, and pushes the merge back.
 * A failed fetch still pushes local data (the server keeps whichever copy is newer) but reports not ok.
 */
export async function syncWithServer(): Promise<{ entries: DailyLearnEntry[]; pushOk: boolean }> {
  if (typeof window === 'undefined') return { entries: [], pushOk: true }
  await ensureIds()
  const remote = await fetchEntriesFromServer()
  const merged = mergeEntries(loadAllEntries(), remote ?? [])
  localStorage.setItem(DAILY_LEARN_ENTRIES_KEY, JSON.stringify(merged))
  const pushOk = (await pushWithRetry(merged)) && remote !== null
  return { entries: visible(merged), pushOk }
}

/**
 * Sets the sync password (or device ID) and merges this browser's entries with that account's.
 * Never replaces local data, so it is safe on a fresh browser and on one that already has entries.
 */
export async function connectSyncKey(key: string): Promise<{ entries: DailyLearnEntry[]; pushOk: boolean }> {
  setSyncKey(key)
  idsReady = null
  return syncWithServer()
}

/** Returns visible entries, newest first. */
export function loadEntries(): DailyLearnEntry[] {
  return visible(loadAllEntries())
}

/** Saves an entry (empty text writes a tombstone) and syncs. Returns false if the sync failed. */
export async function saveEntry(entry: { date: string; text: string }): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const all = loadAllEntries()
  const text = capitalizeFirst(entry.text.trim())
  const idx = all.findIndex((e) => e.date === entry.date)
  if (!text && (idx < 0 || !all[idx]!.text.trim())) return true
  const updated: DailyLearnEntry = { date: entry.date, text, updatedAt: new Date().toISOString() }
  if (idx >= 0) all[idx] = updated
  else all.push(updated)
  localStorage.setItem(DAILY_LEARN_ENTRIES_KEY, JSON.stringify(sortByDateDesc(all)))
  const { pushOk } = await syncWithServer()
  return pushOk
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

/** Merge CSV rows into local storage (latest `updatedAt` wins per date); then sync push. */
export async function importMergedCsv(csvText: string): Promise<{
  success: boolean
  parseError?: string
  rowsFromFile: number
  mergedTotal: number
  pushOk: boolean
}> {
  if (typeof window === 'undefined') {
    return {
      success: false,
      parseError: 'Import only runs in the browser',
      rowsFromFile: 0,
      mergedTotal: 0,
      pushOk: false,
    }
  }
  const prior = loadAllEntries()
  const parsed = parseDailyLearnCsv(csvText)
  if (parsed.error) {
    return {
      success: false,
      parseError: parsed.error,
      rowsFromFile: 0,
      mergedTotal: visible(prior).length,
      pushOk: false,
    }
  }
  const fromFile = parsed.entries as DailyLearnEntry[]
  const merged = mergeEntries(prior, fromFile)
  localStorage.setItem(DAILY_LEARN_ENTRIES_KEY, JSON.stringify(merged))
  const pushOk = await pushWithRetry(merged)
  return {
    success: true,
    rowsFromFile: fromFile.length,
    mergedTotal: visible(merged).length,
    pushOk,
  }
}

/** One header row + one row per entry (full history); safe for commas and quotes in `text`. */
export function exportAsCsv(): string {
  const entries = loadEntries().map((e) => ({ ...e, text: capitalizeFirst(e.text) }))
  return formatDailyLearnCsv(entries)
}

export function exportAsJson(): string {
  const entries = loadEntries().map((e) => ({ ...e, text: capitalizeFirst(e.text) }))
  return JSON.stringify(entries, null, 2)
}
