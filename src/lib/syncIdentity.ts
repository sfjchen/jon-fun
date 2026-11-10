/**
 * Client sync identity shared by Daily Learn, Notes and Reader.
 * Each browser has 1 device ID and at most 1 sync key, kept in localStorage and mirrored to a server cookie and
 * the server's device links (/api/sync/identity), so Safari's 7-day storage wipe no longer strands new entries
 * under a fresh ID. Typing the key once on a browser is all it needs.
 */

const KEY = 'sfjc_sync_key'
const DEVICE = 'sfjc_device_id'
const LABEL = 'sfjc_device_label'
const LEGACY_KEYS = ['daily_learn_sync_key', 'notes_sync_key']
const LEGACY_IDS = ['daily_learn_user_id', 'notes_user_id', 'notes_device_label', 'sfjc_approved_key']
const API = '/api/sync/identity'
export const OWNER_SYNC_KEY = 'sfjc'
export const SYNC_IDENTITY_CHANGED = 'sfjc-sync-identity-changed'

/**
 * Reads localStorage, returning '' on the server or when storage is blocked.
 */
function read(k: string): string {
  try {
    return typeof window === 'undefined' ? '' : (localStorage.getItem(k) ?? '')
  } catch {
    return ''
  }
}

/**
 * Writes localStorage (an empty value removes the key), ignoring blocked storage.
 */
function write(k: string, v: string): void {
  try {
    if (v) localStorage.setItem(k, v)
    else localStorage.removeItem(k)
  } catch {
    /* storage blocked: ids live for this page load only */
  }
}

/**
 * Returns a random UUID, with a Math.random fallback for old browsers.
 */
export function genUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** True when this page load minted the device ID, so a cookie-saved ID may still replace it. */
let minted = false

/**
 * Returns this browser's device ID, creating one on first use.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = read(DEVICE)
  if (!id) {
    id = genUuid()
    minted = true
    write(DEVICE, id)
  }
  return id
}

/** Returns the sync key, or '' when this browser keeps its data under its device ID only. */
export function getSyncKey(): string {
  return read(KEY)
}

/** Returns the user_id the apps read and write: the sync key when set, else the device ID. */
export function getEffectiveUserId(): string {
  return getSyncKey() || getDeviceId()
}

/** Reports whether this browser uses the owner key (shows owner-only UI). */
export function isOwnerDevice(): boolean {
  return getSyncKey() === OWNER_SYNC_KEY
}

/** Returns the credentials every synced API call sends. */
export function syncCredentials(): { userId: string; deviceUserId: string } {
  return { userId: getEffectiveUserId(), deviceUserId: getDeviceId() }
}

/** Returns the custom device name, or '' when unset. */
export function getDeviceLabel(): string {
  return read(LABEL).trim()
}

/**
 * Returns a readable default name for this browser from its user agent, e.g. "Safari on iPhone".
 */
function defaultLabel(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' :
    /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'device'
  return `${browser} on ${os}`
}

let ready: Promise<void> | null = null

/**
 * Calls the identity API, returning parsed JSON or null on any failure.
 */
async function call<T>(method: string, body?: object): Promise<T | null> {
  try {
    const res = await fetch(API, {
      method,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/**
 * Restores ids from the server cookie when storage was wiped, folds in the old per-app keys once, then links
 * this device to its key on the server. Runs once per page load (concurrent callers share it) and clears itself
 * on failure so the next sync retries.
 */
export function ensureSyncIdentity(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  ready ??= (async () => {
    if (!read(DEVICE) || minted) {
      const saved = await call<{ syncKey?: string; deviceId?: string }>('GET')
      if (saved?.deviceId) write(DEVICE, saved.deviceId)
      minted = false
      if (saved?.syncKey && !read(KEY)) write(KEY, saved.syncKey)
    }
    if (!read(KEY)) write(KEY, LEGACY_KEYS.map(read).find(Boolean) ?? '')
    if (!read(LABEL)) write(LABEL, read('notes_device_label'))
    for (const k of [...LEGACY_KEYS, ...LEGACY_IDS]) write(k, '')
    const r = await call<{ syncKey: string }>('POST', {
      syncKey: getSyncKey(),
      deviceId: getDeviceId(),
      label: getDeviceLabel() || defaultLabel(),
    })
    if (!r) throw new Error('link failed')
    write(KEY, r.syncKey)
    window.dispatchEvent(new Event(SYNC_IDENTITY_CHANGED))
  })().catch(() => {
    ready = null
  })
  return ready
}

/**
 * Subscribes to identity changes (for useSyncExternalStore) and starts the link, so owner-only UI updates once
 * a restored key arrives.
 */
export function subscribeSyncIdentity(cb: () => void): () => void {
  window.addEventListener(SYNC_IDENTITY_CHANGED, cb)
  void ensureSyncIdentity()
  return () => window.removeEventListener(SYNC_IDENTITY_CHANGED, cb)
}

/**
 * Sets the sync key (shared by every app) and ties this device to it on the server.
 */
export async function connectSyncKey(key: string): Promise<void> {
  write(KEY, key.trim())
  ready = null
  await ensureSyncIdentity()
}

/**
 * Renames this device locally and on the server.
 */
export async function setDeviceLabel(label: string): Promise<void> {
  write(LABEL, label.trim())
  ready = null
  await ensureSyncIdentity()
}
