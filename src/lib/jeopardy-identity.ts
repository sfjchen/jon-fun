// Per-device collaborator identity, plus the recent-boards list: kept in localStorage and synced to the sync
// account (/api/jeopardy/recents), so the list follows the sync key to every device.
import { v4 as uuidv4 } from 'uuid'
import { ensureSyncIdentity, getDevicePlayer, getEffectiveUserId, saveDevicePlayer } from '@/lib/syncIdentity'

const ID_KEY = 'jeopardy:editor-id'
const NAME_KEY = 'jeopardy:editor-name'
const COLOR_KEY = 'jeopardy:editor-color'
const RECENT_KEY = 'jeopardy:recents'
const RECENTS_API = '/api/jeopardy/recents'
export const MAX_RECENTS = 12

const COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#22c55e',
  '#0ea5e9',
  '#a855f7',
]

export interface EditorIdentity {
  id: string
  name: string
  color: string
}

export function getOrCreateIdentity(): EditorIdentity {
  if (typeof window === 'undefined') return { id: '', name: '', color: COLORS[0]! }
  let id = localStorage.getItem(ID_KEY)
  if (!id) {
    id = uuidv4()
    localStorage.setItem(ID_KEY, id)
  }
  let color = localStorage.getItem(COLOR_KEY)
  if (!color) {
    color = COLORS[Math.floor(Math.random() * COLORS.length)]!
    localStorage.setItem(COLOR_KEY, color)
  }
  const name = getDevicePlayer()?.name || (localStorage.getItem(NAME_KEY) || '').trim()
  return { id, name, color }
}

export function setEditorName(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 40))
  if (name.trim()) saveDevicePlayer({ name, group: getDevicePlayer()?.group ?? 'public' })
}

export interface RecentBoard {
  slug: string
  title: string
  visitedAt: number
}

export function getRecents(): RecentBoard[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x: unknown) => !!x && typeof (x as RecentBoard).slug === 'string') : []
  } catch {
    return []
  }
}

/**
 * Sends this device's recents to its sync account and replaces the local list with the merged one, so boards
 * opened on the account's other devices show here. Visits made while the request is in flight are kept.
 */
export async function syncRecents(): Promise<void> {
  if (typeof window === 'undefined') return
  const at = Date.now()
  try {
    await ensureSyncIdentity()
    const res = await fetch(RECENTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getEffectiveUserId(), recents: getRecents() }),
    })
    if (!res.ok) return
    const { recents } = (await res.json()) as { recents: RecentBoard[] }
    const fresh = getRecents().filter((r) => r.visitedAt > at)
    const merged = [...fresh, ...recents.filter((r) => !fresh.some((f) => f.slug === r.slug))]
    localStorage.setItem(RECENT_KEY, JSON.stringify(merged.slice(0, MAX_RECENTS)))
  } catch {
    /* offline: the local list stands until the next visit */
  }
}

let syncTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Puts a board at the top of the recents list and syncs it shortly after, so a title typed letter by letter
 * sends 1 request.
 */
export function pushRecent(slug: string, title: string): void {
  if (typeof window === 'undefined') return
  const list = getRecents().filter((r) => r.slug !== slug)
  list.unshift({ slug, title: title || slug, visitedAt: Date.now() })
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)))
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => void syncRecents(), 1500)
}

/**
 * Takes a board off the recents list on this device and on its sync account.
 */
export async function removeRecent(slug: string): Promise<void> {
  if (typeof window === 'undefined') return
  const list = getRecents().filter((r) => r.slug !== slug)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  try {
    await fetch(RECENTS_API, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getEffectiveUserId(), slug }),
    })
  } catch {
    /* offline: the board returns on the next sync and can be removed again */
  }
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.slice(0, 2) || '?').toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}
