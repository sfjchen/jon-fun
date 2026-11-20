/**
 * Client sync identity shared by Daily Learn, Notes and Reader.
 * Each browser has 1 device ID and at most 1 sync key, kept in localStorage and mirrored to a server cookie and
 * the server's device links (/api/sync/identity), so Safari's 7-day storage wipe no longer strands new entries
 * under a fresh ID. Typing the key once on a browser is all it needs.
 */

const KEY = 'sfjc_sync_key'
const DEVICE = 'sfjc_device_id'
const LABEL = 'sfjc_device_label'
const PLAYER = 'sfjc_player'
export type DevicePlayer = { name: string; group: string }
export const PLAYER_IDENTITY_CHANGED = 'sfjc-player-changed'

export function getDevicePlayer(): DevicePlayer | null {
  try {
    const p = JSON.parse(read(PLAYER) || 'null') as DevicePlayer | null
    return p && typeof p.name === 'string' && p.name.trim() && typeof p.group === 'string' && /^[a-z0-9-]{3,32}$/.test(p.group) ? p : null
  } catch { return null }
}

/** Saves the one name used by games, log device stamps and reader comments. */
export function saveDevicePlayer(player: DevicePlayer): void {
  const name = player.name.trim().slice(0, 24)
  if (!name || !/^[a-z0-9-]{3,32}$/.test(player.group)) return
  write(PLAYER, JSON.stringify({ name, group: player.group }))
  write(LABEL, name)
  window.dispatchEvent(new Event(PLAYER_IDENTITY_CHANGED))
  window.dispatchEvent(new Event(SYNC_IDENTITY_CHANGED))
  // Serialize saves behind any in-flight restore so an older request cannot replace a rename.
  const previous = ready
  ready = null
  void (previous ?? Promise.resolve()).then(() => { ready = null; return ensureSyncIdentity() })
}
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
  return getDevicePlayer()?.name || read(LABEL).trim()
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

export const DEVICE_KINDS = ['phone', 'tablet', 'computer'] as const
export type DeviceKind = (typeof DEVICE_KINDS)[number]

/**
 * Classifies this browser as a phone, tablet or computer. iPads in desktop mode report a Mac user agent, so a Mac
 * with a touch screen counts as a tablet.
 */
export function deviceKind(): DeviceKind {
  const ua = navigator.userAgent
  const hint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile
  if (hint || /iPhone|iPod|Android.+Mobile|Mobile.+Firefox|Windows Phone/.test(ua)) return 'phone'
  if (/iPad|Android|Tablet/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet'
  return 'computer'
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
    if (!read(DEVICE) || minted || !getDevicePlayer()) {
      const saved = await call<{ syncKey?: string; deviceId?: string; player?: DevicePlayer }>('GET')
      // Restore the name and its ID together, even if another app minted an ID before restoration.
      if (saved?.deviceId && (!read(DEVICE) || minted || (!getDevicePlayer() && saved.player))) write(DEVICE, saved.deviceId)
      minted = false
      if (saved?.syncKey && !read(KEY)) write(KEY, saved.syncKey)
      if (saved?.player && !getDevicePlayer()) {
        write(PLAYER, JSON.stringify(saved.player))
        write(LABEL, saved.player.name)
      }
    }
    if (!read(KEY)) write(KEY, LEGACY_KEYS.map(read).find(Boolean) ?? '')
    if (!read(LABEL)) write(LABEL, read('notes_device_label'))
    if (!getDevicePlayer()) {
      const name = (getDeviceLabel() || read('reader-comment-display-name-v1') || read('jeopardy:editor-name')).trim().slice(0,24)
      if (name) { write(PLAYER,JSON.stringify({name,group:'public'})); write(LABEL,name) }
    }
    for (const k of [...LEGACY_KEYS, ...LEGACY_IDS]) write(k, '')
    const profile = getDevicePlayer()
    if (profile) write(LABEL,profile.name)
    const r = await call<{ syncKey: string; player?: DevicePlayer }>('POST', {
      syncKey: getSyncKey(),
      deviceId: getDeviceId(),
      label: getDeviceLabel() || defaultLabel(),
      kind: deviceKind(),
      ...(profile ? { player: profile } : {}),
    })
    if (!r) throw new Error('link failed')
    write(KEY, r.syncKey)
    if (r.player && !getDevicePlayer()) { write(PLAYER, JSON.stringify(r.player)); write(LABEL, r.player.name) }
    window.dispatchEvent(new Event(SYNC_IDENTITY_CHANGED))
    window.dispatchEvent(new Event(PLAYER_IDENTITY_CHANGED))
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
  if (label.trim()) saveDevicePlayer({ name: label, group: getDevicePlayer()?.group ?? 'public' })
}
