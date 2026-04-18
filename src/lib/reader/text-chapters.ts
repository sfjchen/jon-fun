import { v4 as uuidv4 } from 'uuid'
import { formatImportParagraphs } from '@/lib/reader/paragraph-format'
import type { ReaderChapter, ReaderImportDraft, ReaderSourceType } from '@/lib/reader/types'

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

function cleanParagraph(paragraph: string): string {
  return paragraph.replace(/\s+/g, ' ').trim()
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

function applyReadingFormatToChapters(chapters: ReaderChapter[]): ReaderChapter[] {
  return chapters.map((ch, order) => {
    const paras = formatImportParagraphs(ch.paragraphs)
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
}): ReaderImportDraft {
  const title =
    input.title?.trim() ||
    input.originalFileName?.replace(/\.[^/.]+$/, '').trim() ||
    'Untitled reader import'
  let chapters = chapterizeText(input.rawText, input.sourceType)
  chapters = applyReadingFormatToChapters(chapters)

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
  importNotes.push('Paragraphs were spaced for reading: blank lines split blocks; long passages split at sentences.')

  const draft: ReaderImportDraft = {
    title,
    sourceType: input.sourceType,
    chapters,
    importNotes,
  }

  if (input.originalFileName) draft.originalFileName = input.originalFileName

  return draft
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

  let chapters = input.spineChapters.map((c, order) => {
    const paras = c.paragraphs.map((p) => cleanParagraph(p)).filter(Boolean)
    const chTitle = c.title.trim() || chapterTitleFromIndex(order)
    return makeChapter(chTitle, paras, order)
  })
  chapters = applyReadingFormatToChapters(chapters)

  const importNotes = [...(input.notes ?? [])]
  if (!importNotes.some((n) => /spine/i.test(n))) {
    importNotes.push('Chapters follow the EPUB spine reading order.')
  }
  importNotes.push('Paragraphs were spaced for reading: blank lines split blocks; long passages split at sentences.')

  const draft: ReaderImportDraft = {
    title,
    sourceType: 'epub',
    chapters,
    importNotes,
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

export function splitChapterAtMidpoint(chapters: ReaderChapter[], chapterId: string): ReaderChapter[] {
  const index = chapters.findIndex((chapter) => chapter.id === chapterId)
  if (index === -1) return chapters

  const chapter = chapters[index]
  if (!chapter) return chapters
  if (chapter.paragraphs.length < 2) return chapters

  const midpoint = Math.floor(chapter.paragraphs.length / 2)
  const left = makeChapter(`${chapter.title} (A)`, chapter.paragraphs.slice(0, midpoint), chapter.order, chapter.id)
  const right = makeChapter(`${chapter.title} (B)`, chapter.paragraphs.slice(midpoint), chapter.order + 1)
  const next = [...chapters]
  next.splice(index, 1, left, right)
  return next.map((item, order) => ({ ...item, order }))
}
