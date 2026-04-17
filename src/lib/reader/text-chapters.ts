import { v4 as uuidv4 } from 'uuid'
import type { ReaderChapter, ReaderImportDraft, ReaderSourceType } from '@/lib/reader/types'

const CHAPTER_HEADING_RE =
  /^(chapter|chap\.?|book|part|section|episode|prologue|epilogue)\s+((\d+|[ivxlcdm]+)([\s.:~-].*)?|[a-z0-9'":,\- ]+)$/i

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

    if (CHAPTER_HEADING_RE.test(line) && (currentParagraphs.length > 0 || currentParagraphLines.length > 0 || chapters.length > 0)) {
      flushParagraph()
      finalizeChapter(chapters, currentTitle || chapterTitleFromIndex(chapters.length), currentParagraphs)
      currentTitle = line
      currentParagraphs.length = 0
      continue
    }

    if (CHAPTER_HEADING_RE.test(line) && !currentTitle && currentParagraphs.length === 0 && currentParagraphLines.length === 0) {
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

export function chapterizeText(raw: string): ReaderChapter[] {
  const normalized = normalizeText(raw)
  if (!normalized) return []

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
  const chapters = chapterizeText(input.rawText)

  const draft: ReaderImportDraft = {
    title,
    sourceType: input.sourceType,
    chapters,
    importNotes: input.notes ?? [],
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
