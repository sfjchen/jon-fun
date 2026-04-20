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
    instruction:
      'Indices are 0-based. Only suggest merging CONSECUTIVE chapters (startIndex..endIndex inclusive on the right). Prefer merging only when excerpts clearly look like front matter, legal boilerplate, TOC fragments, or empty spine noise — not real story chapters. When unsure, suggest nothing. Return strict JSON: { "merges": [ { "startIndex": number, "endIndex": number, "reason": string } ], "notes": string[] }',
  }
}

export const SUGGEST_SYSTEM_PROMPT =
  'You help fix e-reader imports. You only output valid JSON. Be conservative: false negatives are better than merging real chapters.'
