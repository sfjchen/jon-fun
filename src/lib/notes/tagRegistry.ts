import type { NoteSession } from './types'

const CATALOG_KEY = 'notes_tag_catalog'

/** Default kind/category tags (editable catalog seeds). */
export const DEFAULT_TAG_CATALOG = [
  'IC',
  'GP',
  'meeting',
  'learning',
  'internal',
  'endowment',
  'portfolio',
]

export function loadTagCatalog(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_TAG_CATALOG]
  try {
    const raw = localStorage.getItem(CATALOG_KEY)
    if (!raw) return [...DEFAULT_TAG_CATALOG]
    const arr = JSON.parse(raw) as string[]
    return Array.isArray(arr) && arr.length ? arr : [...DEFAULT_TAG_CATALOG]
  } catch {
    return [...DEFAULT_TAG_CATALOG]
  }
}

export function saveTagCatalog(tags: string[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CATALOG_KEY, JSON.stringify(tags))
}

export function addToTagCatalog(tag: string): string[] {
  const t = tag.trim().replace(/^#/, '')
  if (!t) return loadTagCatalog()
  const cat = loadTagCatalog()
  if (cat.includes(t)) return cat
  const next = [...cat, t]
  saveTagCatalog(next)
  return next
}

/** Remove tag from global picker catalog (does not edit notes). */
export function removeFromTagCatalog(tag: string): string[] {
  const t = tag.trim().replace(/^#/, '')
  if (!t) return loadTagCatalog()
  const next = loadTagCatalog().filter((x) => x !== t)
  saveTagCatalog(next)
  return next
}

/** Catalog + every tag used on any note, sorted for picker UI. */
export function listKnownTags(sessions: NoteSession[]): string[] {
  const set = new Set(loadTagCatalog())
  for (const s of sessions) {
    for (const t of s.tags ?? []) set.add(t)
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
