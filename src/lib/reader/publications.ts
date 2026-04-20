import type { ReaderPublication, ReaderPublicationSummary } from '@/lib/reader/types'
import {
  deleteReaderPublicationIdb,
  getAllReaderPublicationsIdb,
  getReaderPublicationIdb,
  importReaderPublicationsMergeIdb,
  listReaderPublicationsIdb,
  saveReaderPublicationIdb,
} from '@/lib/reader/publications-idb'

const COMMUNAL = '/api/reader/communal'

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

export async function listReaderPublications(): Promise<ReaderPublicationSummary[]> {
  const remote = await communalList()
  if (remote !== null) return remote
  return listReaderPublicationsIdb()
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
    body: JSON.stringify(publications[0]),
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
      body: JSON.stringify(publications[i]),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(typeof (err as { error?: string }).error === 'string' ? (err as { error: string }).error : 'Import failed')
    }
  }
}

export async function getReaderPublication(id: string): Promise<ReaderPublication | null> {
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
    body: JSON.stringify(publication),
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
  const res = await fetch(`${COMMUNAL}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (res.status === 503) {
    await deleteReaderPublicationIdb(id)
    return
  }
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}))
    throw new Error(typeof (err as { error?: string }).error === 'string' ? (err as { error: string }).error : 'Delete failed')
  }
}
