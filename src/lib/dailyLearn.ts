/**
 * 1 Sentence Everyday – localStorage utilities and cross-device sync.
 * One entry per calendar day. Sync merges by date with the latest updatedAt winning, and deletions
 * travel as empty-text tombstones so a stale device cannot bring a deleted entry back. When 2 devices each wrote a
 * different text for the same day before syncing, the newer one shows and the other is kept beside it as a conflict
 * until the user picks.
 */

import { formatDailyLearnCsv, parseDailyLearnCsv } from './dailyLearnCsv'
import { ensureSyncIdentity, syncCredentials } from './syncIdentity'

export interface DailyLearnEntry {
  date: string // 'YYYY-MM-DD'
  text: string
  updatedAt: string // ISO timestamp
  /** Another device's text for the same day (several separated by newlines), kept until the user picks. */
  conflict?: string
}

export interface DailyLearnCounts {
  total: number
  thisWeek: number
  thisMonth: number
}

/** localStorage key for entry JSON array — exported for E2E (End-to-End) and tooling */
export const DAILY_LEARN_ENTRIES_KEY = 'daily_learn_entries'

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

/** Sorts entries newest date first. */
function sortByDateDesc(entries: DailyLearnEntry[]): DailyLearnEntry[] {
  return entries.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
}

/** Parses an ISO timestamp to epoch ms, treating missing or invalid values as 0 so they never win a merge. */
function tsMs(iso: string | undefined): number {
  const t = Date.parse(iso ?? '')
  return Number.isNaN(t) ? 0 : t
}

/** Splits a conflict field into its texts. */
export function conflictTexts(e: DailyLearnEntry): string[] {
  return (e.conflict ?? '').split('\n').filter(Boolean)
}

/**
 * Merges entries by date, keeping the latest updatedAt (ties keep the first list's copy).
 * Empty-text entries are tombstones: they carry a deletion across devices instead of letting it resurrect.
 *
 * `synced` maps each date to the updatedAt this device last had in step with the server. With it, a day is a clash
 * when both sides hold a different text and neither is that synced version, which means each device wrote its own
 * since they last agreed. The newer text then shows and the other is kept in `conflict`, under a fresh updatedAt so
 * every device receives the pair. A side that already carries the other's text is taken as is, so a clash is
 * recorded once. Without `synced` (a file import) the newest simply wins.
 */
export function mergeEntries(
  local: DailyLearnEntry[],
  remote: DailyLearnEntry[],
  synced?: Record<string, string>,
): DailyLearnEntry[] {
  const clean = (e: DailyLearnEntry): DailyLearnEntry => ({ ...e, text: capitalizeFirst((e.text ?? '').trim()) })
  const byDate = new Map(local.map((e) => [e.date, clean(e)]))
  for (const raw of remote) {
    const r = clean(raw),
      l = byDate.get(r.date)
    const [newer, older] = !l || tsMs(r.updatedAt) > tsMs(l.updatedAt) ? [r, l] : [l, r]
    // A side knows the other's text when it already holds every line of it, as its own text or as a kept one. This
    // covers a clash the other device recorded first, and a settled entry that joins both texts.
    const knows = (a: DailyLearnEntry, b: DailyLearnEntry) => {
      const held = [a.text, ...conflictTexts(a)].flatMap((t) => t.split('\n'))
      return b.text.split('\n').every((line) => held.includes(line))
    }
    const clash =
      synced &&
      older &&
      l &&
      l.text &&
      r.text &&
      l.text !== r.text &&
      ![l.updatedAt, r.updatedAt].includes(synced[r.date] ?? '') &&
      !knows(l, r) &&
      !knows(r, l)
    byDate.set(
      r.date,
      clash
        ? {
            ...newer,
            updatedAt: new Date().toISOString(),
            // Line breaks separate the kept texts, so a kept text is stored on 1 line.
            conflict: [
              ...new Set([older.text.replace(/\n+/g, ' '), ...conflictTexts(older), ...conflictTexts(newer)]),
            ].join('\n'),
          }
        : newer,
    )
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
    const res = await fetch(`/api/daily-learn/entries?${new URLSearchParams(syncCredentials())}`)
    if (!res.ok) return null
    const data = (await res.json()) as { entries?: DailyLearnEntry[] }
    return Array.isArray(data.entries) ? data.entries : []
  } catch {
    return null
  }
}

const SEEDED_KEY = 'daily_learn_synced_seeded'
const PUSH_RETRIES = 3
const RETRY_DELAY_MS = 500

/** Pushes entries with their own updatedAt so the server only overwrites rows older than each one. */
async function pushWithRetry(entries: DailyLearnEntry[]): Promise<boolean> {
  const body = JSON.stringify({
    ...syncCredentials(),
    entries: entries.map((e) => ({ date: e.date, text: e.text, updatedAt: e.updatedAt, conflict: e.conflict ?? null })),
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

/**
 * Fetches from the server, merges with local, saves local, and pushes the merge back.
 * A failed fetch still pushes local data (the server keeps whichever copy is newer) but reports not ok.
 */
export function syncWithServer(): Promise<{ entries: DailyLearnEntry[]; pushOk: boolean }> {
  if (typeof window === 'undefined') return Promise.resolve({ entries: [], pushOk: true })
  // Syncs run 1 at a time, so 2 overlapping ones cannot each record the same clash under its own timestamp.
  const next = syncing.then(syncOnce, syncOnce)
  syncing = next.catch(() => undefined)
  return next
}

let syncing: Promise<unknown> = Promise.resolve()

/**
 * Runs 1 fetch, merge and push for syncWithServer.
 */
async function syncOnce(): Promise<{ entries: DailyLearnEntry[]; pushOk: boolean }> {
  await ensureSyncIdentity()
  const remote = await fetchEntriesFromServer()
  // The synced versions are kept per account, so a device that joins another sync key compares from scratch.
  const syncedKey = `daily_learn_synced:${syncCredentials().userId}`
  let synced: Record<string, string> = {}
  try {
    // A browser that synced before conflicts existed starts from what it holds, so its older copies of days edited
    // elsewhere update quietly instead of all showing as conflicts.
    if (!localStorage.getItem(SEEDED_KEY)) {
      localStorage.setItem(SEEDED_KEY, '1')
      localStorage.setItem(
        syncedKey,
        JSON.stringify(Object.fromEntries(loadAllEntries().map((e) => [e.date, e.updatedAt]))),
      )
    }
    synced = JSON.parse(localStorage.getItem(syncedKey) ?? '{}') as Record<string, string>
  } catch {}
  const merged = mergeEntries(loadAllEntries(), remote ?? [], remote ? synced : undefined)
  localStorage.setItem(DAILY_LEARN_ENTRIES_KEY, JSON.stringify(merged))
  const pushOk = (await pushWithRetry(merged)) && remote !== null
  if (pushOk)
    localStorage.setItem(syncedKey, JSON.stringify(Object.fromEntries(merged.map((e) => [e.date, e.updatedAt]))))
  return { entries: visible(merged), pushOk }
}

/** Returns visible entries, newest first. */
export function loadEntries(): DailyLearnEntry[] {
  return visible(loadAllEntries())
}

/**
 * Saves an entry (empty text writes a tombstone) and syncs. Returns false if the sync failed. A save replaces the
 * whole entry, so saving a day that holds a conflict settles it.
 */
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
