import type { ReaderPublication, ReaderPublicationSummary } from '@/lib/reader/types'

const DB_NAME = 'sfjc-reader'
const DB_VERSION = 1
const STORE = 'publications'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

function txRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

function toSummary(publication: ReaderPublication): ReaderPublicationSummary {
  return {
    id: publication.id,
    title: publication.title,
    sourceType: publication.sourceType,
    chapterCount: publication.chapters.length,
    totalWords: publication.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    updatedAt: publication.updatedAt,
    firstChapterId: publication.chapters[0]?.id ?? '',
  }
}

export async function listReaderPublications(): Promise<ReaderPublicationSummary[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const all = await txRequest(store.getAll())
  db.close()

  return (all as ReaderPublication[])
    .map(toSummary)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

/** Full books for export / backup (cross-device via shared JSON file). */
export async function getAllReaderPublications(): Promise<ReaderPublication[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const all = await txRequest(store.getAll())
  db.close()
  return (all as ReaderPublication[]).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

/** Merge imported publications into IndexedDB (overwrites same `id`). */
export async function importReaderPublicationsMerge(publications: ReaderPublication[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  for (const pub of publications) {
    await txRequest(store.put(pub))
  }
  db.close()
}

export async function getReaderPublication(id: string): Promise<ReaderPublication | null> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const publication = await txRequest(store.get(id))
  db.close()
  return (publication as ReaderPublication | undefined) ?? null
}

export async function saveReaderPublication(publication: ReaderPublication): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  await txRequest(store.put(publication))
  db.close()
}

export async function deleteReaderPublication(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  await txRequest(store.delete(id))
  db.close()
}
