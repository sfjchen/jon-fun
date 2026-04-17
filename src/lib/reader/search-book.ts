import type { ReaderPublication } from '@/lib/reader/types'

export type ReaderSearchHit = {
  chapterId: string
  /** Index within chapter.paragraphs */
  paragraphIndex: number
  /** Byte offset in paragraph string (for ordering) */
  offset: number
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** All non-overlapping substring hits in reading order (chapter order, then paragraph, then offset). */
export function findSearchHits(publication: ReaderPublication, rawQuery: string): ReaderSearchHit[] {
  const q = rawQuery.trim()
  if (!q) return []

  const lower = q.toLowerCase()
  const hits: ReaderSearchHit[] = []

  for (const ch of publication.chapters) {
    ch.paragraphs.forEach((paragraph, paragraphIndex) => {
      const pl = paragraph.toLowerCase()
      let idx = 0
      let pos = 0
      while ((pos = pl.indexOf(lower, idx)) !== -1) {
        hits.push({ chapterId: ch.id, paragraphIndex, offset: pos })
        idx = pos + 1
      }
    })
  }

  return hits
}

export function hitKey(hit: ReaderSearchHit): string {
  return `${hit.chapterId}:${hit.paragraphIndex}:${hit.offset}`
}
