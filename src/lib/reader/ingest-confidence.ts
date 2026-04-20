import type { ReaderChapter, ReaderIngestMeta } from '@/lib/reader/types'

/** Heuristic confidence for TXT/paste chapterization (0–1). */
export function scoreTxtChapterizeConfidence(chapters: ReaderChapter[], rawTextLength: number): ReaderIngestMeta {
  const flags: string[] = []
  if (chapters.length < 2) {
    flags.push('single_chapter_blob')
  }
  const avgWords = chapters.length
    ? chapters.reduce((s, c) => s + c.wordCount, 0) / chapters.length
    : 0
  if (chapters.length > 1 && avgWords < 120) {
    flags.push('short_chapters_avg')
  }
  if (rawTextLength > 0 && chapters.length > rawTextLength / 8000) {
    flags.push('many_small_chapters')
  }

  let overallConfidence = 0.72
  if (chapters.length >= 2 && chapters.length <= 200) overallConfidence += 0.08
  if (avgWords > 400) overallConfidence += 0.1
  if (flags.includes('single_chapter_blob')) overallConfidence -= 0.25
  if (flags.includes('many_small_chapters')) overallConfidence -= 0.15
  overallConfidence = Math.max(0, Math.min(1, overallConfidence))

  return { overallConfidence, flags }
}

export function mergeIngestMeta(a: ReaderIngestMeta | undefined, b: ReaderIngestMeta | undefined): ReaderIngestMeta | undefined {
  if (!a && !b) return undefined
  const flags = [...new Set([...(a?.flags ?? []), ...(b?.flags ?? [])])]
  const ocA = a?.overallConfidence
  const ocB = b?.overallConfidence
  const overallConfidence =
    ocA != null && ocB != null ? Math.min(ocA, ocB) : ocA ?? ocB ?? 0.5
  return { overallConfidence, flags }
}

export function pdfExtractIngestMeta(pageCount: number, totalChars: number, scannedLikely: boolean): ReaderIngestMeta {
  const flags: string[] = []
  if (scannedLikely) flags.push('scanned_pdf_likely')
  if (pageCount > 0 && totalChars / pageCount < 40) flags.push('low_text_density')
  const overallConfidence = scannedLikely ? 0.35 : Math.min(1, 0.55 + Math.min(0.35, (totalChars / Math.max(pageCount, 1)) / 400))
  return { overallConfidence, flags }
}

export function epubDefaultIngestMeta(sectionCount: number): ReaderIngestMeta {
  return {
    overallConfidence: Math.min(1, 0.75 + Math.min(0.2, sectionCount / 500)),
    flags: ['epub_spine_ok'],
  }
}
