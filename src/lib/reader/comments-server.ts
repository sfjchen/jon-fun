import { communalReaderBackendReady } from '@/lib/reader/communal-server'

export type ReaderPublicationCommentRow = {
  id: string
  publication_id: string
  chapter_id: string
  block_id: string
  body: string
  author_display: string
  author_fingerprint: string
  created_at: string
}

export type ReaderPublicationCommentDto = {
  id: string
  publicationId: string
  chapterId: string
  blockId: string
  body: string
  authorDisplay: string
  authorFingerprint: string
  createdAt: string
}

export function commentsBackendReady(): boolean {
  return communalReaderBackendReady()
}

export function rowToDto(row: ReaderPublicationCommentRow): ReaderPublicationCommentDto {
  return {
    id: row.id,
    publicationId: row.publication_id,
    chapterId: row.chapter_id,
    blockId: row.block_id,
    body: row.body,
    authorDisplay: row.author_display,
    authorFingerprint: row.author_fingerprint,
    createdAt: row.created_at,
  }
}

/** Matches `readerBlockIdForParagraph`: `b-{chapterId}-p{index}` with `-p{digits}` at end. */
const BLOCK_ID_RE = /^b-.+-p\d+$/

export function assertValidBlockId(blockId: string): void {
  if (!BLOCK_ID_RE.test(blockId)) throw new Error('Invalid block anchor')
}

export function parseCommentPostBody(body: unknown): {
  publicationId: string
  chapterId: string
  blockId: string
  body: string
  authorDisplay: string
  authorFingerprint: string
} {
  if (!body || typeof body !== 'object') throw new Error('Invalid body')
  const o = body as Record<string, unknown>
  const publicationId = typeof o.publicationId === 'string' ? o.publicationId.trim() : ''
  const chapterId = typeof o.chapterId === 'string' ? o.chapterId.trim() : ''
  const blockId = typeof o.blockId === 'string' ? o.blockId.trim() : ''
  const text = typeof o.body === 'string' ? o.body.trim() : ''
  const authorDisplay = typeof o.authorDisplay === 'string' ? o.authorDisplay.trim() : ''
  const authorFingerprint = typeof o.authorFingerprint === 'string' ? o.authorFingerprint.trim() : ''
  if (!publicationId || publicationId.length > 80) throw new Error('Invalid publicationId')
  if (!chapterId || chapterId.length > 200) throw new Error('Invalid chapterId')
  assertValidBlockId(blockId)
  if (!text || text.length > 4000) throw new Error('Comment must be 1–4000 characters')
  if (!authorDisplay || authorDisplay.length > 64) throw new Error('Display name must be 1–64 characters')
  if (!authorFingerprint || authorFingerprint.length > 80) throw new Error('Invalid author key')
  return { publicationId, chapterId, blockId, body: text, authorDisplay, authorFingerprint }
}
