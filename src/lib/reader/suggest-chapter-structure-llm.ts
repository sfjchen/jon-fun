/** Shared types + response parsing for `/api/reader/suggest-chapter-structure`. */

import type { ReaderSourceType } from '@/lib/reader/types'

export type { ReaderSourceType }

export type IncomingChapterExcerpt = {
  index: number
  title: string
  wordCount: number
  paragraphCount: number
  excerptHead: string
  excerptTail?: string
}

export type IncomingSuggestBody = {
  bookTitle: string
  sourceType: ReaderSourceType
  originalFileName?: string | null
  chapters: IncomingChapterExcerpt[]
}

export type LlmMerge = { startIndex: number; endIndex: number; reason: string }

export type LlmSplitChapter = { chapterIndex: number; reason: string }

/** Gemini REST `Schema` shape (v1beta): uppercase type enums. */
/** Omit per-item `required` arrays — some Gemini API versions reject nested required. */
export const GEMINI_CHAPTER_STRUCTURE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    merges: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          startIndex: { type: 'INTEGER' },
          endIndex: { type: 'INTEGER' },
          reason: { type: 'STRING' },
        },
      },
    },
    splitChapters: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          chapterIndex: { type: 'INTEGER' },
          reason: { type: 'STRING' },
        },
      },
    },
    notes: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    formatNotes: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['merges', 'splitChapters', 'notes', 'formatNotes'],
} as const

export function clampMerges(raw: unknown, chapterCount: number): { merges: LlmMerge[]; notes: string[] } {
  if (!raw || typeof raw !== 'object') return { merges: [], notes: ['LLM returned no object.'] }
  const o = raw as { merges?: unknown; notes?: unknown }
  const notes = Array.isArray(o.notes) ? o.notes.filter((n) => typeof n === 'string').map(String) : []
  const mergesIn = o.merges
  if (!Array.isArray(mergesIn)) return { merges: [], notes }

  const merges: LlmMerge[] = []
  for (const item of mergesIn) {
    if (!item || typeof item !== 'object') continue
    const it = item as { startIndex?: unknown; endIndex?: unknown; reason?: unknown }
    if (typeof it.startIndex !== 'number' || typeof it.endIndex !== 'number') continue
    const startIndex = Math.floor(it.startIndex)
    const endIndex = Math.floor(it.endIndex)
    if (
      startIndex < 0 ||
      endIndex < 0 ||
      startIndex >= chapterCount ||
      endIndex >= chapterCount ||
      endIndex <= startIndex
    ) {
      continue
    }
    merges.push({
      startIndex,
      endIndex,
      reason: typeof it.reason === 'string' ? it.reason : 'Model suggestion',
    })
  }
  return { merges, notes }
}

export function clampSplitChapters(
  raw: unknown,
  chapterCount: number,
  minParagraphs: number[],
): { splits: LlmSplitChapter[]; notes: string[] } {
  const extra: string[] = []
  if (!raw || typeof raw !== 'object') return { splits: [], notes: [] }
  const o = raw as { splitChapters?: unknown }
  const arr = o.splitChapters
  if (!Array.isArray(arr)) return { splits: [], notes: [] }

  const seen = new Set<number>()
  const splits: LlmSplitChapter[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const it = item as { chapterIndex?: unknown; reason?: unknown }
    if (typeof it.chapterIndex !== 'number') continue
    const chapterIndex = Math.floor(it.chapterIndex)
    if (chapterIndex < 0 || chapterIndex >= chapterCount) continue
    if (seen.has(chapterIndex)) continue
    const paras = minParagraphs[chapterIndex] ?? 0
    if (paras < 2) {
      extra.push(`Ignored AI split for chapter ${chapterIndex + 1}: need at least 2 paragraphs.`)
      continue
    }
    seen.add(chapterIndex)
    splits.push({
      chapterIndex,
      reason: typeof it.reason === 'string' ? it.reason : 'Possible two chapters in one blob',
    })
  }
  return { splits, notes: extra }
}

export function clampFormatNotes(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return []
  const o = raw as { formatNotes?: unknown }
  if (!Array.isArray(o.formatNotes)) return []
  return o.formatNotes
    .filter((n) => typeof n === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((s) => s.slice(0, 400))
}

export function extractJsonFromAssistantText(text: string): unknown {
  const t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t)
  const raw = fence ? fence[1]!.trim() : t
  return JSON.parse(raw) as unknown
}

export function buildSuggestPayload(truncated: IncomingChapterExcerpt[], body: IncomingSuggestBody) {
  return {
    bookTitle: body.bookTitle,
    sourceType: body.sourceType,
    originalFileName: body.originalFileName,
    chapters: truncated,
    instruction: `Indices are 0-based (chapter index = position in the chapters array).

1) merges: Only CONSECUTIVE chapters (startIndex..endIndex inclusive). Merge when excerpts clearly show front matter, legal boilerplate, TOC (Table of Contents) junk, near-empty spine sections, or duplicate title noise — NOT real narrative chapters. When unsure, omit.

2) splitChapters: Chapters where excerptHead/excerptTail suggest TWO real chapters were glued into one (e.g. a mid-text chapter title, part break, or abrupt topic change mid-excerpt). Only suggest if wordCount is large enough that a split is plausible. Prefer at most a few high-confidence entries. User will split at word midpoint as a first pass — do not assume perfect cut points.

3) notes: Short factual bullets about structure (max ~6). Can be empty.

4) formatNotes: Optional spacing/typography observations from excerpts only (e.g. missing paragraph breaks, run-on lines, suspicious ALL CAPS blocks). Advisory only; no rewriting. Max ~6 short strings.

Return JSON with keys merges, splitChapters, notes, formatNotes (arrays; use [] when none).`,
  }
}

export const SUGGEST_SYSTEM_PROMPT =
  'You fix e-reader import structure from short excerpts and metadata only. Output must match the requested JSON shape. Be conservative on merges (false negatives OK). Do not invent content not hinted in excerpts.'
