import type { ReaderPublication, ReaderPublicationSummary } from '@/lib/reader/types'
import { parsePortableLibrary } from '@/lib/reader/library-portable'
import { notesSyncCredentials } from '@/lib/notes/syncCredentials'
import {
  deleteReaderPublicationIdb,
  getAllReaderPublicationsIdb,
  getReaderPublicationIdb,
  importReaderPublicationsMergeIdb,
  listReaderPublicationsIdb,
  saveReaderPublicationIdb,
} from '@/lib/reader/publications-idb'

const COMMUNAL = '/api/reader/communal'
const HIDDEN_KEY = 'reader:v1:hidden-books'
let samplesReq: Promise<ReaderPublication[]> | null = null

/**
 * Reports whether an id belongs to the built-in sample shelf.
 * Sample ids never exist on the communal backend, so callers skip its routes for them.
 */
export function isSamplePublicationId(id: string): boolean {
  return id.startsWith('sample-')
}

/**
 * Loads the read-only public-domain sample shelf shipped at /reader/samples.json.
 * Samples are never written to IndexedDB or the communal shelf, so they cannot duplicate or mix with saved books.
 */
export function loadSamplePublications(): Promise<ReaderPublication[]> {
  samplesReq ??= fetch('/reader/samples.json')
    .then(async (res) => (res.ok ? parsePortableLibrary(await res.text()) : []))
    .catch(() => [])
  return samplesReq
}

async function communalList(): Promise<ReaderPublicationSummary[] | null> {
  try {
    const res = await fetch(COMMUNAL, { cache: 'no-store' })
    if (res.status === 503) return null
    if (!res.ok) return null
    return (await res.json()) as ReaderPublicationSummary[]
  } catch {
    return null
  }
}

/**
 * Returns the shared-shelf book ids this device removed from its own view.
 * Stored per browser, so other devices still see the books.
 */
function hiddenIds(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as unknown
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * Removes a shared-shelf book from this device only. The book stays on the shelf for everyone else.
 */
export function hideReaderPublication(id: string): void {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...new Set([...hiddenIds(), id])]))
}

export async function listReaderPublications(): Promise<ReaderPublicationSummary[]> {
  const remote = await communalList()
  if (remote === null) return listReaderPublicationsIdb()
  const hidden = new Set(hiddenIds())
  return remote.filter((p) => !hidden.has(p.id))
}

export async function getAllReaderPublications(): Promise<ReaderPublication[]> {
  try {
    const res = await fetch(`${COMMUNAL}?export=1`, { cache: 'no-store' })
    if (res.status === 503) return getAllReaderPublicationsIdb()
    if (!res.ok) throw new Error(`Library export failed (${res.status})`)
    return (await res.json()) as ReaderPublication[]
  } catch {
    return getAllReaderPublicationsIdb()
  }
}

export async function importReaderPublicationsMerge(publications: ReaderPublication[]): Promise<void> {
  if (publications.length === 0) return
  const first = await fetch(COMMUNAL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...publications[0], ...notesSyncCredentials() }),
  })
  if (first.status === 503) {
    await importReaderPublicationsMergeIdb(publications)
    return
  }
  if (!first.ok) {
    const err = await first.json().catch(() => ({}))
    throw new Error(typeof (err as { error?: string }).error === 'string' ? (err as { error: string }).error : 'Import failed')
  }
  for (let i = 1; i < publications.length; i++) {
    const res = await fetch(COMMUNAL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...publications[i], ...notesSyncCredentials() }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(typeof (err as { error?: string }).error === 'string' ? (err as { error: string }).error : 'Import failed')
    }
  }
}

export async function getReaderPublication(id: string): Promise<ReaderPublication | null> {
  if (isSamplePublicationId(id)) return (await loadSamplePublications()).find((p) => p.id === id) ?? null
  try {
    const res = await fetch(`${COMMUNAL}/${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (res.status === 503) return getReaderPublicationIdb(id)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Book load failed (${res.status})`)
    return (await res.json()) as ReaderPublication
  } catch {
    return getReaderPublicationIdb(id)
  }
}

export async function saveReaderPublication(publication: ReaderPublication): Promise<void> {
  const res = await fetch(COMMUNAL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...publication, ...notesSyncCredentials() }),
  })
  if (res.status === 503) {
    await saveReaderPublicationIdb(publication)
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(typeof (err as { error?: string }).error === 'string' ? (err as { error: string }).error : 'Save failed')
  }
}

export async function deleteReaderPublication(id: string): Promise<void> {
  const res = await fetch(`${COMMUNAL}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notesSyncCredentials()),
  })
  if (res.status === 503) {
    await deleteReaderPublicationIdb(id)
    return
  }
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}))
    throw new Error(typeof (err as { error?: string }).error === 'string' ? (err as { error: string }).error : 'Delete failed')
  }
}
