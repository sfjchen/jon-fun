import { SFJC_ADMIN_DEVICE_IDS } from '@/data/sfjc-admin-devices'
import { getOrCreateUserId } from './deviceIdentity'
import type { NoteSession } from './types'

const CATALOG_KEY = 'notes_tag_catalog'

/** Neutral starter tags for visitors (editable catalog seeds). Tags already used on notes still join the picker. */
export const DEFAULT_TAG_CATALOG = ['meeting', 'learning', 'idea', 'reading']

/** Jon's work tags, seeded only on his registered devices. */
const OWNER_TAG_CATALOG = ['IC', 'GP', 'meeting', 'learning', 'internal', 'endowment', 'portfolio']

/**
 * Returns the saved tag catalog, or the starter tags for this device when none is saved.
 * Owner devices start with Jon's work tags, every other device with neutral ones.
 */
export function loadTagCatalog(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_TAG_CATALOG]
  const seed = SFJC_ADMIN_DEVICE_IDS.has(getOrCreateUserId()) ? OWNER_TAG_CATALOG : DEFAULT_TAG_CATALOG
  try {
    const arr = JSON.parse(localStorage.getItem(CATALOG_KEY) ?? '[]') as unknown
    return Array.isArray(arr) && arr.length ? (arr as string[]) : [...seed]
  } catch {
    return [...seed]
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
