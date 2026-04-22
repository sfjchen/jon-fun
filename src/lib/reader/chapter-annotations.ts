/**
 * In-chapter annotations: text anchors (Web Annotation–style selectors),
 * comment threads, highlights, and pen strokes. Local-first in localStorage.
 */
import { v4 as uuidv4 } from 'uuid'

/** W3C Web Annotation style text quote (subset). */
export type TextQuoteSelector = {
  type: 'TextQuoteSelector'
  exact: string
  /** Optional disambiguation (best-effort, may be empty). */
  prefix?: string
  suffix?: string
}

export type TextPositionSelector = {
  type: 'TextPositionSelector'
  start: number
  end: number
}

export type CommentAnchor =
  | { kind: 'block'; blockId: string }
  | { kind: 'range'; blockId: string; quote: TextQuoteSelector; position: TextPositionSelector }
  | { kind: 'gap'; afterParagraphIndex: number }

export type ReaderAnnotationMessage = {
  id: string
  body: string
  authorDisplay: string
  authorFingerprint: string
  createdAt: string
}

export type ReaderCommentThread = {
  id: string
  anchor: CommentAnchor
  messages: ReaderAnnotationMessage[]
  /** If imported from shared API, keep reference for merge. */
  sourceApiId?: string
}

export type ReaderUserHighlight = {
  id: string
  blockId: string
  color: 'yellow' | 'green' | 'blue'
  quote: TextQuoteSelector
  position: TextPositionSelector
  note?: string
}

export type PenPoint = { x: number; y: number }

/** Normalized 0..1 in reading column, plus vertical anchor block for re-layout. */
export type ReaderPenStroke = {
  id: string
  blockId: string
  points: PenPoint[]
  color: string
  width: number
  /** 0 = top of block, 1 = bottom of block for first point reference. */
  anchorY: number
}

export type ChapterAnnotationBundle = {
  version: 1
  threads: ReaderCommentThread[]
  highlights: ReaderUserHighlight[]
  penStrokes: ReaderPenStroke[]
}

export const emptyChapterAnnotationBundle = (): ChapterAnnotationBundle => ({
  version: 1,
  threads: [],
  highlights: [],
  penStrokes: [],
})

function storageKey(publicationId: string, chapterId: string): string {
  return `reader:v1:chapter-annotations:${publicationId}:${chapterId}`
}

export function loadChapterAnnotations(publicationId: string, chapterId: string): ChapterAnnotationBundle {
  if (typeof window === 'undefined') return emptyChapterAnnotationBundle()
  try {
    const raw = window.localStorage.getItem(storageKey(publicationId, chapterId))
    if (!raw) return emptyChapterAnnotationBundle()
    const parsed = JSON.parse(raw) as ChapterAnnotationBundle
    if (parsed?.version !== 1 || !Array.isArray(parsed.threads)) return emptyChapterAnnotationBundle()
    return {
      version: 1,
      threads: parsed.threads,
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      penStrokes: Array.isArray(parsed.penStrokes) ? parsed.penStrokes : [],
    }
  } catch {
    return emptyChapterAnnotationBundle()
  }
}

export function saveChapterAnnotations(publicationId: string, chapterId: string, bundle: ChapterAnnotationBundle): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(publicationId, chapterId), JSON.stringify(bundle))
  } catch {
    /* ignore quota */
  }
}

export function normalizeParagraphText(s: string): string {
  return s.replace(/\r\n/g, '\n')
}

const PREFIX_LEN = 32
const SUFFIX_LEN = 32

export function buildTextQuoteFromRange(text: string, start: number, end: number): TextQuoteSelector {
  const n = normalizeParagraphText(text)
  const a = Math.max(0, Math.min(start, n.length))
  const b = Math.max(a, Math.min(end, n.length))
  const exact = n.slice(a, b)
  const prefix = n.slice(Math.max(0, a - PREFIX_LEN), a)
  const suffix = n.slice(b, Math.min(n.length, b + SUFFIX_LEN))
  return { type: 'TextQuoteSelector', exact, prefix, suffix }
}

export function buildPositionSelector(start: number, end: number): TextPositionSelector {
  return { type: 'TextPositionSelector', start, end }
}

/** Find [start, end) of quote in `text` using exact match first, then prefix/suffix trim. */
export function resolveQuoteInParagraph(text: string, quote: TextQuoteSelector): { start: number; end: number } | null {
  const n = normalizeParagraphText(text)
  if (!quote.exact) return null
  const idx = n.indexOf(quote.exact)
  if (idx >= 0) {
    if (quote.prefix) {
      const pfxEnd = idx
      const pfxStart = Math.max(0, pfxEnd - quote.prefix.length)
      const before = n.slice(pfxStart, pfxEnd)
      if (before && !quote.prefix.endsWith(before) && !before.endsWith(quote.prefix.slice(-Math.min(8, quote.prefix.length)))) {
        /* allow weak match: still use idx */
      }
    }
    return { start: idx, end: idx + quote.exact.length }
  }
  if (quote.prefix && quote.suffix) {
    const p = n.indexOf(quote.prefix)
    if (p < 0) return null
    const afterP = p + quote.prefix.length
    const s = n.indexOf(quote.suffix, afterP)
    if (s < 0) return null
    const mid = n.slice(afterP, s)
    if (mid.includes(quote.exact)) {
      const inner = afterP + mid.indexOf(quote.exact)
      return { start: inner, end: inner + quote.exact.length }
    }
  }
  return null
}

export function newMessage(body: string, authorDisplay: string, authorFingerprint: string): ReaderAnnotationMessage {
  return {
    id: uuidv4(),
    body: body.trim(),
    authorDisplay: authorDisplay.slice(0, 64),
    authorFingerprint,
    createdAt: new Date().toISOString(),
  }
}

export function newThread(anchor: CommentAnchor, first: ReaderAnnotationMessage): ReaderCommentThread {
  return { id: uuidv4(), anchor, messages: [first] }
}

export function newHighlight(
  blockId: string,
  start: number,
  end: number,
  text: string,
  color: ReaderUserHighlight['color'] = 'yellow',
): ReaderUserHighlight {
  const quote = buildTextQuoteFromRange(text, start, end)
  return {
    id: uuidv4(),
    blockId,
    color,
    quote,
    position: buildPositionSelector(start, end),
  }
}

export function newPenStroke(
  blockId: string,
  points: PenPoint[],
  color: string,
  width: number,
  anchorY: number,
): ReaderPenStroke {
  return { id: uuidv4(), blockId, points, color, width, anchorY }
}

/**
 * Import legacy API block comments as threads (block anchors), deduped by `sourceApiId`.
 */
export function mergeApiBlockComments(
  bundle: ChapterAnnotationBundle,
  rows: { id: string; blockId: string; body: string; authorDisplay: string; authorFingerprint: string; createdAt: string }[],
): ChapterAnnotationBundle {
  const seen = new Set(bundle.threads.map((t) => t.sourceApiId).filter(Boolean) as string[])
  const next = { ...bundle, threads: [...bundle.threads] }
  for (const r of rows) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    next.threads.push({
      id: uuidv4(),
      sourceApiId: r.id,
      anchor: { kind: 'block', blockId: r.blockId },
      messages: [
        {
          id: r.id,
          body: r.body,
          authorDisplay: r.authorDisplay,
          authorFingerprint: r.authorFingerprint,
          createdAt: r.createdAt,
        },
      ],
    })
  }
  return next
}

export function countThreadsForBlock(bundle: ChapterAnnotationBundle, blockId: string): number {
  return bundle.threads.filter((t) => t.anchor.kind === 'block' && t.anchor.blockId === blockId).length
}

export function countThreadsForGap(bundle: ChapterAnnotationBundle, afterParagraphIndex: number): number {
  return bundle.threads.filter((t) => t.anchor.kind === 'gap' && t.anchor.afterParagraphIndex === afterParagraphIndex)
    .length
}
