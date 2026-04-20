import { parsePortableLibrary } from '@/lib/reader/library-portable'
import { importReaderPublicationsMerge } from '@/lib/reader/publications'

/**
 * Operator-maintained portable library shipped at /reader/library-curated.json.
 * Bump when the JSON changes so existing visitors re-merge (stable publication `id`s update in place).
 */
export const BUNDLED_READER_CATALOG_VERSION = '2'

const CATALOG_PATH = '/reader/library-curated.json'

export type BundledCatalogSyncResult =
  | { kind: 'merged'; count: number }
  | { kind: 'empty' }
  | { kind: 'skipped'; reason: 'already-synced' | 'unavailable' }
  | { kind: 'error'; message: string }

function storageKey(): string {
  return `reader-bundled-catalog-${BUNDLED_READER_CATALOG_VERSION}`
}

function session404Key(): string {
  return `reader-catalog-404-${BUNDLED_READER_CATALOG_VERSION}`
}

/**
 * Merge curated publications into IndexedDB (Indexed Database API). Overwrites same `id`.
 * @param force - Clear sync flags and retry (manual refresh).
 */
export async function syncBundledReaderCatalog(force = false): Promise<BundledCatalogSyncResult> {
  if (typeof window === 'undefined') {
    return { kind: 'error', message: 'Not in browser.' }
  }

  const key = storageKey()
  const s404 = session404Key()

  if (force) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(s404)
  }

  const prev = localStorage.getItem(key)
  if (!force && (prev === 'ok' || prev === 'empty')) {
    return { kind: 'skipped', reason: 'already-synced' }
  }

  if (!force && sessionStorage.getItem(s404) === '1') {
    return { kind: 'skipped', reason: 'unavailable' }
  }

  try {
    const res = await fetch(`${CATALOG_PATH}?v=${encodeURIComponent(BUNDLED_READER_CATALOG_VERSION)}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      sessionStorage.setItem(s404, '1')
      return { kind: 'skipped', reason: 'unavailable' }
    }

    const pubs = parsePortableLibrary(await res.text())
    if (!pubs.length) {
      localStorage.setItem(key, 'empty')
      return { kind: 'empty' }
    }

    await importReaderPublicationsMerge(pubs)
    localStorage.setItem(key, 'ok')
    return { kind: 'merged', count: pubs.length }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not load site catalog.'
    return { kind: 'error', message }
  }
}
