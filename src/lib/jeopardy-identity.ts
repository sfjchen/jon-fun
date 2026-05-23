// Per-device collaborator identity & recent-boards list, persisted to localStorage.
import { v4 as uuidv4 } from 'uuid'

const ID_KEY = 'jeopardy:editor-id'
const NAME_KEY = 'jeopardy:editor-name'
const COLOR_KEY = 'jeopardy:editor-color'
const RECENT_KEY = 'jeopardy:recents'

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#22c55e', '#0ea5e9', '#a855f7',
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
  const name = (localStorage.getItem(NAME_KEY) || '').trim()
  return { id, name, color }
}

export function setEditorName(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 40))
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

export function pushRecent(slug: string, title: string): void {
  if (typeof window === 'undefined') return
  const list = getRecents().filter((r) => r.slug !== slug)
  list.unshift({ slug, title: title || slug, visitedAt: Date.now() })
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12)))
}

export function removeRecent(slug: string): void {
  if (typeof window === 'undefined') return
  const list = getRecents().filter((r) => r.slug !== slug)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.slice(0, 2) || '?').toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}
