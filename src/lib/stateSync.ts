/**
 * Mirrors this browser's device-only state (game runs and archives, reader progress, bookmarks and annotations,
 * personal bests) to its sync account through /api/sync/state, so it follows the sync key to every device and
 * survives a storage wipe. Per entry the newest edit wins. Entries a device held before its first sync count as
 * oldest, so a first sync adds to both sides and replaces nothing newer.
 */
import { ensureSyncIdentity, getEffectiveUserId, SYNC_IDENTITY_CHANGED } from '@/lib/syncIdentity'

const PREFIXES = [
  'chainle:v1:',
  'daily-collection:v1:',
  'fivefold:nyt-v2:',
  'krillion:v3:',
  'connections:v2:',
  'mini:v3:',
  'anthropeum:',
  'orbs:v1:',
  'sfjc_orbs_archive:',
  'set:v1:',
  'sb:',
  'sfjc_future_practice:',
  'reader:v1:progress',
  'reader:v1:bookmark',
  'reader:v1:chapter-annotations:',
]
const EXACT = [
  'triples_best_seconds',
  'moc-history-v1',
  'moc-best-v1',
  'fivefold:hard',
  'reader:v1:last-book',
  'reader:v1:last-route',
  'reader:v1:hidden-books',
]
/** The largest entry the mirror carries, and the most it sends in 1 request. */
export const MAX_VALUE = 500_000
export const MAX_BATCH = 100
const MAX_BODY = 1_000_000
const API = '/api/sync/state'
const META = 'sfjc_state_meta'

export type StateEntry = { key: string; value: string; at: number }
/** Per entry: the hash of the value last seen, when it was edited, and whether the account holds that edit. */
type Meta = { user: string; since: string; keys: Record<string, [hash: string, at: number, pushed: 0 | 1]> }

/**
 * Reports whether a storage key is mirrored. `sb:shared` is a once-per-browser flag, so it stays behind.
 */
export function isSyncedKey(key: string): boolean {
  return key !== 'sb:shared' && key.length <= 200 && (EXACT.includes(key) || PREFIXES.some((p) => key.startsWith(p)))
}

/**
 * Returns a short hash of a value, enough to tell that it changed.
 */
function hash(v: string): string {
  let h = 5381
  for (let i = 0; i < v.length; i++) h = ((h << 5) + h + v.charCodeAt(i)) | 0
  return `${v.length}.${h}`
}

/**
 * Records every mirrored entry that changed since the last scan, stamped with the time of this scan.
 */
function scan(meta: Meta, first: boolean): void {
  const now = Date.now()
  for (const k of Object.keys(localStorage)) {
    if (!isSyncedKey(k)) continue
    const v = localStorage.getItem(k) ?? ''
    if (v.length > MAX_VALUE) continue
    const h = hash(v),
      m = meta.keys[k]
    if (!m) meta.keys[k] = [h, first ? 1 : now, 0]
    else if (m[0] !== h) meta.keys[k] = [h, now, 0]
  }
}

let running = false,
  pulledAt = 0

/**
 * Sends this browser's changed entries to its account and writes the account's newer entries here. With
 * `pull` off it only talks to the server when something changed.
 */
export async function syncState(pull = true): Promise<void> {
  if (running || typeof window === 'undefined') return
  running = true
  try {
    await ensureSyncIdentity()
    const user = getEffectiveUserId()
    if (!user) return
    let meta = JSON.parse(localStorage.getItem(META) ?? 'null') as Meta | null
    const first = !meta
    // A device that joins a key keeps its edit times and sends everything to the new account.
    if (meta?.user !== user) {
      const keys = Object.fromEntries(Object.entries(meta?.keys ?? {}).map(([k, m]) => [k, [m[0], m[1], 0]]))
      meta = { user, since: '', keys: keys as Meta['keys'] }
    }
    scan(meta, first)
    for (let pass = 0; pass < 30; pass++) {
      const entries: StateEntry[] = []
      let size = 0
      for (const [key, m] of Object.entries(meta.keys)) {
        if (m[2] || entries.length >= MAX_BATCH || size > MAX_BODY) continue
        const value = localStorage.getItem(key)
        if (value === null || hash(value) !== m[0]) continue
        entries.push({ key, value, at: m[1] })
        size += value.length
      }
      if (!entries.length && !pull && pass === 0) break
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user, since: meta.since, entries }),
      })
      if (!res.ok) break
      const r = (await res.json()) as { entries: StateEntry[]; since: string; more: boolean }
      for (const e of entries) if (meta.keys[e.key]?.[0] === hash(e.value)) meta.keys[e.key] = [hash(e.value), e.at, 1]
      for (const e of r.entries) {
        const m = meta.keys[e.key]
        if (!isSyncedKey(e.key) || (m && e.at <= m[1])) continue
        try {
          if (localStorage.getItem(e.key) !== e.value) localStorage.setItem(e.key, e.value)
          meta.keys[e.key] = [hash(e.value), e.at, 1]
        } catch {
          /* storage full: the entry stays on the account */
        }
      }
      meta.since = r.since
      pulledAt = Date.now()
      localStorage.setItem(META, JSON.stringify(meta))
      if (!r.more && entries.length < MAX_BATCH && size <= MAX_BODY) break
    }
    localStorage.setItem(META, JSON.stringify(meta))
  } catch {
    /* offline or storage blocked: the next pass retries */
  } finally {
    running = false
  }
}

/**
 * Keeps the mirror current while the site is open: a full sync on load, on return to the tab and when the sync
 * key changes, a send of changed entries every 30 seconds and when the tab hides, and a pull every 5 minutes.
 * Returns a cleanup function.
 */
export function startStateSync(): () => void {
  const full = () => void syncState()
  const onVisibility = () => void syncState(document.visibilityState === 'visible')
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') void syncState(Date.now() - pulledAt > 300_000)
  }, 30_000)
  full()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener(SYNC_IDENTITY_CHANGED, full)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener(SYNC_IDENTITY_CHANGED, full)
  }
}
