import { readerProgressStorageKey } from '@/lib/reader/settings'
import type { ReaderProgress } from '@/lib/reader/types'

const REMOTE_TS_KEY = 'reader:v1:remote-progress-ts'

function remoteTsKey(bookId: string, chapterId: string): string {
  return `${REMOTE_TS_KEY}:${bookId}:${chapterId}`
}

/** Best-effort push of reading position to communal backend (no throw on failure). */
export async function syncRemoteReadingState(
  bookId: string,
  chapterId: string,
  scrollY: number,
  anchor?: { blockId?: string; charOffset?: number },
): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const payload: ReaderProgress = {
      chapterId,
      scrollY,
      savedAt: new Date().toISOString(),
      schemaVersion: 2,
      ...(anchor?.blockId ? { blockId: anchor.blockId, charOffset: anchor.charOffset ?? 0 } : {}),
    }
    const res = await fetch(`/api/reader/communal/${encodeURIComponent(bookId)}/reading-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      window.localStorage.setItem(remoteTsKey(bookId, chapterId), payload.savedAt)
    }
  } catch {
    /* ignore */
  }
}

/** Merge server reading state into localStorage if newer (called after book load). */
export async function mergeRemoteReadingStateIfNewer(bookId: string, chapterId: string): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch(`/api/reader/communal/${encodeURIComponent(bookId)}/reading-state`, { cache: 'no-store' })
    if (res.status === 503 || res.status === 404) return
    if (!res.ok) return
    const data = (await res.json()) as { progress?: ReaderProgress | null }
    const remote = data.progress
    if (!remote || typeof remote.scrollY !== 'number' || remote.chapterId !== chapterId) return

    const localKey = readerProgressStorageKey(bookId, chapterId)
    const raw = window.localStorage.getItem(localKey)
    const local = raw ? (JSON.parse(raw) as ReaderProgress) : null
    const localTime = local?.savedAt ? Date.parse(local.savedAt) : 0
    const remoteTime = Date.parse(remote.savedAt)
    if (remoteTime > localTime) {
      window.localStorage.setItem(localKey, JSON.stringify({ ...remote, chapterId }))
    }
  } catch {
    /* ignore */
  }
}
