import { isStructuredChapterHeadingLine } from '@/lib/reader/text-chapters'
import type { ReaderChapter, ReaderImportDraft, ReaderSourceType } from '@/lib/reader/types'

const DEFAULT_TINY_WORDS = 72
const RUN_MIN = 2 /** Suggest merging only if at least this many consecutive tiny chapters. */

export type ChapterMergeSuggestion = {
  startIndex: number
  endIndex: number
  reason: string
  kind: 'heuristic'
}

export type ChapterSplitHint = {
  chapterIndex: number
  title: string
  reason: string
}

export type ImportChapterAnalysis = {
  sourceType: ReaderSourceType
  tinyWordThreshold: number
  tinyChapterIndices: number[]
  duplicateTitleGroups: { normalized: string; indices: number[] }[]
  heuristicMerges: ChapterMergeSuggestion[]
  splitHints: ChapterSplitHint[]
  stats: {
    chapterCount: number
    totalWords: number
    medianChapterWords: number
    shortChapterFraction: number
  }
}

function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : Math.round(((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2)
}

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** True if first paragraph looks like a real chapter heading inside a long blob. */
function embeddedHeadingSplitHint(ch: ReaderChapter, index: number): ChapterSplitHint | null {
  if (ch.wordCount < 2800) return null
  const first = ch.paragraphs[0]?.trim() ?? ''
  if (first.length > 120) return null
  if (!isStructuredChapterHeadingLine(first)) return null
  for (let pi = 1; pi < Math.min(ch.paragraphs.length, 8); pi++) {
    const line = ch.paragraphs[pi]?.trim() ?? ''
    if (line && isStructuredChapterHeadingLine(line)) {
      return {
        chapterIndex: index,
        title: ch.title,
        reason: `Long chapter (${ch.wordCount} words) has heading-like lines early; consider Split in half or manual split if this is two chapters stuck together.`,
      }
    }
  }
  return null
}

function buildTinyRuns(indices: number[]): { start: number; end: number }[] {
  if (!indices.length) return []
  const sorted = [...new Set(indices)].sort((a, b) => a - b)
  const runs: { start: number; end: number }[] = []
  let start = sorted[0]!
  let prev = sorted[0]!
  for (let i = 1; i < sorted.length; i++) {
    const x = sorted[i]!
    if (x === prev + 1) {
      prev = x
      continue
    }
    if (prev - start + 1 >= RUN_MIN) runs.push({ start, end: prev })
    start = x
    prev = x
  }
  if (prev - start + 1 >= RUN_MIN) runs.push({ start, end: prev })
  return runs
}

/**
 * Deterministic checks for EPUB spine junk, PDF quirks, etc. No network calls.
 * LLM (Large Language Model) suggestions are separate (API route).
 */
export function analyzeImportDraft(
  draft: ReaderImportDraft,
  options?: { tinyWordThreshold?: number },
): ImportChapterAnalysis {
  const tinyWordThreshold = options?.tinyWordThreshold ?? DEFAULT_TINY_WORDS
  const chapters = draft.chapters
  const wordCounts = chapters.map((c) => c.wordCount)
  const totalWords = wordCounts.reduce((a, b) => a + b, 0)
  const med = median(wordCounts)
  const tinyChapterIndices = chapters
    .map((c, i) => (c.wordCount < tinyWordThreshold ? i : -1))
    .filter((i) => i >= 0)

  const shortChapterFraction = chapters.length ? tinyChapterIndices.length / chapters.length : 0

  const titleMap = new Map<string, number[]>()
  chapters.forEach((c, i) => {
    const k = normalizeTitle(c.title)
    if (!k) return
    const arr = titleMap.get(k) ?? []
    arr.push(i)
    titleMap.set(k, arr)
  })
  const duplicateTitleGroups = [...titleMap.entries()]
    .filter(([, idx]) => idx.length > 1)
    .map(([normalized, indices]) => ({ normalized, indices }))

  const runs = buildTinyRuns(tinyChapterIndices)
  const heuristicMerges: ChapterMergeSuggestion[] = runs.map(({ start, end }) => ({
    startIndex: start,
    endIndex: end,
    kind: 'heuristic',
    reason:
      draft.sourceType === 'epub'
        ? `${end - start + 1} consecutive spine sections under ~${tinyWordThreshold} words (typical copyright / half-title noise). Merge into one chapter for fewer TOC jumps.`
        : `${end - start + 1} consecutive very short chapters under ~${tinyWordThreshold} words. Consider merging if they are one logical section.`,
  }))

  const splitHints: ChapterSplitHint[] = []
  chapters.forEach((ch, i) => {
    const hint = embeddedHeadingSplitHint(ch, i)
    if (hint) splitHints.push(hint)
  })

  return {
    sourceType: draft.sourceType,
    tinyWordThreshold,
    tinyChapterIndices,
    duplicateTitleGroups,
    heuristicMerges,
    splitHints,
    stats: {
      chapterCount: chapters.length,
      totalWords,
      medianChapterWords: med,
      shortChapterFraction: Math.round(shortChapterFraction * 1000) / 1000,
    },
  }
}

/** Build a compact payload for the LLM suggestion API (excerpts only). */
export function draftToChapterStructurePayload(draft: ReaderImportDraft, excerptLen = 280) {
  const excerpt = (p: string[]) => {
    const joined = p.join('\n\n')
    if (joined.length <= excerptLen * 2) return { head: joined, tail: '' }
    return { head: joined.slice(0, excerptLen), tail: joined.slice(-excerptLen) }
  }
  return {
    bookTitle: draft.title,
    sourceType: draft.sourceType,
    originalFileName: draft.originalFileName ?? null,
    chapters: draft.chapters.map((c, i) => {
      const { head, tail } = excerpt(c.paragraphs)
      return {
        index: i,
        title: c.title,
        wordCount: c.wordCount,
        paragraphCount: c.paragraphs.length,
        excerptHead: head,
        excerptTail: tail || undefined,
      }
    }),
  }
}
