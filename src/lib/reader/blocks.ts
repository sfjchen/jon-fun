import type { ReaderBlock, ReaderChapter } from '@/lib/reader/types'

/** Deterministic id for paragraph index (stable across sessions when chapter id is stable). */
export function readerBlockIdForParagraph(chapterId: string, paragraphIndex: number): string {
  return `b-${chapterId}-p${paragraphIndex}`
}

/** Build v2 blocks from paragraphs when `chapter.blocks` is absent or length mismatch. */
export function ensureChapterBlocks(chapter: ReaderChapter): ReaderBlock[] {
  if (chapter.blocks && chapter.blocks.length === chapter.paragraphs.length) {
    return chapter.blocks
  }
  return chapter.paragraphs.map((text, i) => ({
    id: readerBlockIdForParagraph(chapter.id, i),
    kind: 'paragraph' as const,
    text,
  }))
}
