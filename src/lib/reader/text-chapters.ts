import { v4 as uuidv4 } from 'uuid'
import { mergeIngestMeta, scoreTxtChapterizeConfidence, epubDefaultIngestMeta } from '@/lib/reader/ingest-confidence'
import { formatImportParagraphs, normalizeLinesKeepVerticalStructure } from '@/lib/reader/paragraph-format'
import type { ReaderChapter, ReaderImportDraft, ReaderIngestMeta, ReaderSourceType } from '@/lib/reader/types'

const CHAPTER_HEADING_RE =
  /^(chapter|chap\.?|book|part|section|episode|prologue|epilogue)\s+((\d+|[ivxlcdm]+)([\s.:~-].*)?|[a-z0-9'":,\- ]+)$/i

/** Single-line titles like “Book 2” or “Part III: …” — used when reflowing PDF lines so headings become chapter boundaries. */
export function isStructuredChapterHeadingLine(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 200) return false
  return CHAPTER_HEADING_RE.test(t)
}

function extractBookNumber(title: string): number | null {
  const m = /^Book\s+(\d{1,2})\b/i.exec(title.trim())
  return m ? Number(m[1]) : null
}

function isBookLineTocNoise(line: string): boolean {
  const t = line.trim()
  if (/index of persons|table of contents|half title page|chronology|appendix$/i.test(t)) return true
  if (/notes\s+index\s+of/i.test(t)) return true
  if (/^Book\s+\d+\s+Notes\s+/i.test(t)) return true
  if (t.length > 140) return true
  return false
}

/**
 * A real "Book N" heading line (Meditations: TOC, then intro prose, then body headings like
 * "Book 1 DEBTS AND LESSONS"). Rejects "Book 1 of the Meditations…" (intro paragraph) and TOC junk.
 */
function isBookSplitLine(line: string): boolean {
  const t = line.trim()
  if (!/^Book\s+(\d{1,2})\b/i.test(t)) return false
  if (t.length > 140) return false
  if (/^Book\s+\d{1,2}\s+of\s+(the|a)\b/i.test(t)) return false
  // Anthology / series appendix lines: "Book 1—The Way of Kings", "Book 2: Title"
  if (/^Book\s+\d{1,2}\s*[—–\-–]/.test(t)) return false
  if (/^Book\s+\d{1,2}\s*:\s*\S/.test(t)) return false
  return !isBookLineTocNoise(t)
}

/** From each candidate "Book 1" in the file, take 1,2,3,… in order; pick the longest run, tie-break to later in file (body after TOC). */
function buildAscendingBookRun(marks: { idx: number; title: string }[], start: number): { idx: number; title: string }[] {
  const run: { idx: number; title: string }[] = []
  let next = 1
  for (let j = start; j < marks.length; j++) {
    const mk = marks[j]
    if (!mk) continue
    const n = extractBookNumber(mk.title)
    if (n === next) {
      run.push(mk)
      next++
    }
  }
  return run
}

function findBestBookHeadingRun(marks: { idx: number; title: string }[]): { idx: number; title: string }[] | null {
  let best: { idx: number; title: string }[] | null = null
  for (let start = 0; start < marks.length; start++) {
    const at = marks[start]
    if (!at || extractBookNumber(at.title) !== 1) continue
    const run = buildAscendingBookRun(marks, start)
    if (run.length < 3) continue
    const runHead = run[0]
    const bestHead = best?.[0]
    if (
      !best ||
      run.length > best.length ||
      (run.length === best.length && runHead && bestHead && runHead.idx > bestHead.idx)
    ) {
      best = run
    }
  }
  return best && best.length >= 3 ? best : null
}

/** TOC / list lines that match CHAPTER_HEADING_RE but should not start a chapter (PDF table of contents, etc.). */
function isTocJunkHeading(line: string): boolean {
  const t = line.trim()
  if (!CHAPTER_HEADING_RE.test(t)) return false
  if (t.length > 120) return true
  if (/^Book\s+\d+/i.test(t) && t.length > 90) return true
  if (/^Chapter\s+\d+/i.test(t) && t.length > 70) return true
  if (/index of|persons|half title|chronology|contents\s+title|title page/i.test(t)) return true
  return false
}

function isHeadingLine(line: string): boolean {
  return CHAPTER_HEADING_RE.test(line) && !isTocJunkHeading(line)
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, '  ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Collapse horizontal whitespace per line; preserve blank lines (EPUB `<br>` / verse). */
function cleanParagraph(paragraph: string): string {
  if (paragraph.includes('\n')) {
    return normalizeLinesKeepVerticalStructure(paragraph)
  }
  return paragraph.replace(/[ \t\f\v]+/g, ' ').trim()
}

function splitParagraphs(raw: string): string[] {
  return normalizeText(raw)
    .split(/\n{2,}/)
    .map(cleanParagraph)
    .filter(Boolean)
}

function chapterTitleFromIndex(index: number): string {
  return `Chapter ${index + 1}`
}

function applyReadingFormatToChapters(
  chapters: ReaderChapter[],
  formatOpts?: { splitLong?: boolean; maxChunkLen?: number; breakSingleNewlines?: boolean },
): ReaderChapter[] {
  const splitLong = formatOpts?.splitLong !== false
  return chapters.map((ch, order) => {
    const fmt: { splitLong: boolean; maxChunkLen?: number; breakSingleNewlines?: boolean } = { splitLong }
    if (formatOpts?.maxChunkLen != null) fmt.maxChunkLen = formatOpts.maxChunkLen
    if (formatOpts?.breakSingleNewlines === true) fmt.breakSingleNewlines = true
    const paras = formatImportParagraphs(ch.paragraphs, fmt)
    return makeChapter(ch.title, paras, order, ch.id)
  })
}

function makeChapter(title: string, paragraphs: string[], order: number, id?: string): ReaderChapter {
  const trimmedTitle = title.trim() || chapterTitleFromIndex(order)
  const baseId = slugify(trimmedTitle) || `chapter-${order + 1}`
  return {
    id: id ?? `${baseId}-${uuidv4().slice(0, 8)}`,
    order,
    title: trimmedTitle,
    paragraphs,
    wordCount: paragraphs.reduce((sum, paragraph) => sum + wordCount(paragraph), 0),
  }
}

function finalizeChapter(chapters: ReaderChapter[], title: string, paragraphs: string[]) {
  const cleaned = paragraphs.map(cleanParagraph).filter(Boolean)
  if (!cleaned.length) return
  chapters.push(makeChapter(title, cleaned, chapters.length))
}

/** One paragraph per non-empty line block (PDF line list). */
function paragraphsFromLineList(lines: string[]): string[] {
  const t = lines.map((l) => l.trim()).filter(Boolean)
  if (!t.length) return []
  return splitParagraphs(t.join('\n\n'))
}

/**
 * Meditations / similar: split on real "Book N" / "Book N: …" lines; merge front matter into Book 1.
 */
function splitOnBookHeadings(normalized: string): ReaderChapter[] | null {
  const lines = normalized.split('\n')
  const marks: { idx: number; title: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? ''
    if (!line) continue
    if (isBookSplitLine(line)) marks.push({ idx: i, title: line })
  }

  const best = findBestBookHeadingRun(marks)
  if (!best || best.length < 3) return null

  const chapters: ReaderChapter[] = []
  for (let m = 0; m < best.length; m++) {
    const cur = best[m]
    const next = best[m + 1]
    if (!cur) continue
    const start = cur.idx + 1
    const end = next ? next.idx : lines.length
    let segment = lines
      .slice(start, end)
      .map((l) => l.trim())
      .filter(Boolean)
    if (m === 0) {
      const first = best[0]
      if (first) {
        const fm = lines
          .slice(0, first.idx)
          .map((l) => l.trim())
          .filter(Boolean)
        if (fm.length) segment = [...fm, ...segment]
      }
    }
    const paragraphs = paragraphsFromLineList(segment)
    if (!paragraphs.length) continue
    chapters.push(makeChapter(cur.title, paragraphs, chapters.length))
  }

  return chapters.length >= 2 ? chapters : null
}

function detectStructuredChapters(normalized: string): ReaderChapter[] {
  const blocks = normalized.split('\n')
  const chapters: ReaderChapter[] = []
  let currentTitle = ''
  let currentParagraphLines: string[] = []
  const currentParagraphs: string[] = []

  const flushParagraph = () => {
    if (!currentParagraphLines.length) return
    currentParagraphs.push(cleanParagraph(currentParagraphLines.join(' ')))
    currentParagraphLines = []
  }

  for (const rawLine of blocks) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      continue
    }

    if (isHeadingLine(line) && (currentParagraphs.length > 0 || currentParagraphLines.length > 0 || chapters.length > 0)) {
      flushParagraph()
      finalizeChapter(chapters, currentTitle || chapterTitleFromIndex(chapters.length), currentParagraphs)
      currentTitle = line
      currentParagraphs.length = 0
      continue
    }

    if (isHeadingLine(line) && !currentTitle && currentParagraphs.length === 0 && currentParagraphLines.length === 0) {
      currentTitle = line
      continue
    }

    currentParagraphLines.push(line)
  }

  flushParagraph()
  finalizeChapter(chapters, currentTitle || chapterTitleFromIndex(chapters.length), currentParagraphs)
  return chapters
}

function chunkParagraphs(paragraphs: string[], targetWords = 1800): ReaderChapter[] {
  const chapters: ReaderChapter[] = []
  let bucket: string[] = []
  let bucketWords = 0

  for (const paragraph of paragraphs) {
    const words = wordCount(paragraph)
    const shouldFlush = bucket.length > 0 && bucketWords >= targetWords

    if (shouldFlush) {
      chapters.push(makeChapter(chapterTitleFromIndex(chapters.length), bucket, chapters.length))
      bucket = []
      bucketWords = 0
    }

    bucket.push(paragraph)
    bucketWords += words
  }

  if (bucket.length) {
    chapters.push(makeChapter(chapterTitleFromIndex(chapters.length), bucket, chapters.length))
  }

  return chapters
}

export function chapterizeText(raw: string, sourceType: ReaderSourceType = 'paste'): ReaderChapter[] {
  const normalized = normalizeText(raw)
  if (!normalized) return []

  if (sourceType === 'pdf') {
    const bookSplit = splitOnBookHeadings(normalized)
    if (bookSplit && bookSplit.length >= 2) return bookSplit
  }

  const structured = detectStructuredChapters(normalized)
  if (structured.length >= 2) return structured

  return chunkParagraphs(splitParagraphs(normalized))
}

export function createImportDraft(input: {
  rawText: string
  title?: string
  originalFileName?: string
  sourceType: ReaderSourceType
  notes?: string[]
  /** e.g. PDF extract heuristics merged with TXT scoring. */
  ingestMeta?: ReaderIngestMeta
}): ReaderImportDraft {
  const title =
    input.title?.trim() ||
    input.originalFileName?.replace(/\.[^/.]+$/, '').trim() ||
    'Untitled reader import'
  let chapters = chapterizeText(input.rawText, input.sourceType)
  chapters = applyReadingFormatToChapters(chapters, { splitLong: true, maxChunkLen: 540 })

  const importNotes = [...(input.notes ?? [])]
  if (
    input.sourceType === 'pdf' &&
    chapters.length >= 2 &&
    chapters.some((c) => /^Book\s+\d+/i.test(c.title))
  ) {
    importNotes.push(
      "Chapters were split on strict 'Book N' headings (typical for Meditations). Title page and TOC lines are merged into Book 1 when present.",
    )
  }
  if (input.sourceType === 'pdf') {
    importNotes.push(
      'PDF body text is not summarized or paraphrased. Mechanical steps only: reflow joins lines with spaces; lines that look like lone page numbers are skipped; a single repair turns split runs “B ook” into “Book” (pdf.js artifact). Compare with the source PDF if a phrase looks wrong.',
    )
  }
  importNotes.push(
    'TXT / paste / EPUB: no model rewriting — only whitespace, line breaks, and splitting very long blocks at sentences for display. Wording and letters stay as extracted.',
  )

  const txtMeta = scoreTxtChapterizeConfidence(chapters, input.rawText.length)
  const mergedMeta = mergeIngestMeta(input.ingestMeta, txtMeta)

  const draft: ReaderImportDraft = {
    title,
    sourceType: input.sourceType,
    chapters,
    importNotes,
    ...(mergedMeta ? { ingestMeta: mergedMeta } : {}),
  }

  if (input.originalFileName) draft.originalFileName = input.originalFileName

  return draft
}

export type EpubSpineSection = { title: string; paragraphs: string[] }

function spineSectionWordCount(section: EpubSpineSection): number {
  return section.paragraphs.reduce((sum, p) => sum + wordCount(p), 0)
}

/**
 * Many trade EPUBs split a visible part heading (e.g. `Book 3 · …`) into a tiny XHTML spine item
 * and put the body in the next item with a generic package `<title>` (often repeating "Meditations").
 * Without this, **12 books** become **12 + 12** (or more) TOC rows.
 */
export function mergeEpubSpineShortBookHeadingIntoFollowing(spine: EpubSpineSection[]): EpubSpineSection[] {
  const out: EpubSpineSection[] = []
  let i = 0
  while (i < spine.length) {
    const cur = spine[i]!
    const wc = spineSectionWordCount(cur)
    const isShortBookHeading = /^book\s+\d+/i.test(cur.title.trim()) && wc < 120
    if (isShortBookHeading && i + 1 < spine.length) {
      const next = spine[i + 1]!
      out.push({
        title: cur.title,
        paragraphs: [...cur.paragraphs, ...next.paragraphs],
      })
      i += 2
      continue
    }
    out.push(cur)
    i += 1
  }
  return out
}

/** Merge very short leading spine sections (half-title, copyright blips) into the following section. */
export function mergeEpubSpineLeadingTrivialSections(
  spine: EpubSpineSection[],
  opts?: { maxTrivialWords?: number; maxIterations?: number },
): EpubSpineSection[] {
  const maxW = opts?.maxTrivialWords ?? 150
  const maxIter = opts?.maxIterations ?? 24
  let s = [...spine]
  let iter = 0
  while (s.length > 1 && iter < maxIter) {
    const a = s[0]!
    const b = s[1]!
    if (spineSectionWordCount(a) < maxW && !/^book\s+\d+/i.test(a.title.trim())) {
      s = [{ title: b.title, paragraphs: [...a.paragraphs, ...b.paragraphs] }, ...s.slice(2)]
      iter++
    } else break
  }
  return s
}

/** EPUB spine already defines chapters; skip heuristic chapterizeText. */
export function createEpubImportDraft(input: {
  packageTitle: string
  spineChapters: { title: string; paragraphs: string[] }[]
  title?: string
  originalFileName?: string
  notes?: string[]
}): ReaderImportDraft {
  const title =
    input.title?.trim() ||
    input.packageTitle?.trim() ||
    input.originalFileName?.replace(/\.[^/.]+$/, '').trim() ||
    'Untitled EPUB import'

  let spineSections: EpubSpineSection[] = input.spineChapters.map((c) => ({
    title: c.title,
    paragraphs: c.paragraphs,
  }))
  const spineCountBefore = spineSections.length
  spineSections = mergeEpubSpineShortBookHeadingIntoFollowing(spineSections)
  /** Long spines only: tiny 2-file EPUBs (e2e minimal) must keep separate sections. */
  if (spineCountBefore >= 20) {
    spineSections = mergeEpubSpineLeadingTrivialSections(spineSections)
  }
  const spineCoalesced = spineCountBefore - spineSections.length

  let chapters = spineSections.map((c, order) => {
    const paras = c.paragraphs.map((p) => cleanParagraph(p)).filter(Boolean)
    const chTitle = c.title.trim() || chapterTitleFromIndex(order)
    return makeChapter(chTitle, paras, order)
  })
  chapters = applyReadingFormatToChapters(chapters, {
    splitLong: true,
    maxChunkLen: 1100,
    breakSingleNewlines: true,
  })

  const importNotes = [...(input.notes ?? [])]
  if (!importNotes.some((n) => /spine/i.test(n))) {
    importNotes.push('Chapters follow the EPUB spine reading order.')
  }
  if (spineCoalesced > 0) {
    importNotes.push(
      `Coalesced ${spineCoalesced} spine section(s): short “Book N” heading files merged with the following body, and very short leading sections merged forward (common in Meditations-style trade EPUBs).`,
    )
  }
  const shortSpineSections = chapters.filter((c) => c.wordCount < 72).length
  if (shortSpineSections >= 2 && chapters.length >= 5) {
    importNotes.push(
      `${shortSpineSections} spine section(s) are very short (under ~72 words)—often front matter or ads. Use Merge up in the import preview if you want fewer TOC (table of contents) entries.`,
    )
  }
  importNotes.push(
    'EPUB body text is not summarized or edited for wording. Spine chapter titles may be inferred from headings (up to 200 chars) but story paragraphs stay as in the file. `<br>`/line breaks preserved where possible; only very long single lines split at ~1100 chars for display.',
  )

  const draft: ReaderImportDraft = {
    title,
    sourceType: 'epub',
    chapters,
    importNotes,
    ingestMeta: epubDefaultIngestMeta(chapters.length),
  }
  if (input.originalFileName) draft.originalFileName = input.originalFileName
  return draft
}

export function renameChapter(chapters: ReaderChapter[], chapterId: string, title: string): ReaderChapter[] {
  return chapters.map((chapter) => (chapter.id === chapterId ? makeChapter(title, chapter.paragraphs, chapter.order, chapter.id) : chapter))
}

export function mergeWithPreviousChapter(chapters: ReaderChapter[], chapterId: string): ReaderChapter[] {
  const index = chapters.findIndex((chapter) => chapter.id === chapterId)
  if (index <= 0) return chapters

  const previous = chapters[index - 1]
  const current = chapters[index]
  if (!previous || !current) return chapters
  const merged = makeChapter(previous.title, [...previous.paragraphs, ...current.paragraphs], previous.order)
  const next = [...chapters]
  next.splice(index - 1, 2, merged)
  return next.map((chapter, chapterIndex) => ({ ...chapter, order: chapterIndex }))
}

/** Merge chapters [startIdx+1 … endIdx] into startIdx (inclusive range on the right). */
export function mergeChapterIndexRange(chapters: ReaderChapter[], startIdx: number, endIdx: number): ReaderChapter[] {
  if (startIdx < 0 || endIdx >= chapters.length || endIdx <= startIdx) return chapters
  let next = [...chapters]
  const times = endIdx - startIdx
  for (let t = 0; t < times; t++) {
    const victim = next[startIdx + 1]
    if (!victim) break
    next = mergeWithPreviousChapter(next, victim.id)
  }
  return next
}

export function splitChapterAtMidpoint(chapters: ReaderChapter[], chapterId: string): ReaderChapter[] {
  const index = chapters.findIndex((chapter) => chapter.id === chapterId)
  if (index === -1) return chapters

  const chapter = chapters[index]
  if (!chapter) return chapters
  if (chapter.paragraphs.length < 2) return chapters

  const paras = chapter.paragraphs
  const halfWords = chapter.wordCount / 2
  let acc = 0
  let cut = 1
  for (let i = 0; i < paras.length; i++) {
    acc += wordCount(paras[i]!)
    if (acc >= halfWords) {
      cut = i + 1
      break
    }
  }
  cut = Math.max(1, Math.min(paras.length - 1, cut))

  const left = makeChapter(`${chapter.title} (A)`, paras.slice(0, cut), chapter.order, chapter.id)
  const right = makeChapter(`${chapter.title} (B)`, paras.slice(cut), chapter.order + 1)
  const next = [...chapters]
  next.splice(index, 1, left, right)
  return next.map((item, order) => ({ ...item, order }))
}
