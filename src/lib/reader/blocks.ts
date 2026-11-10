/** Deterministic id for paragraph index (stable across sessions when chapter id is stable). */
export function readerBlockIdForParagraph(chapterId: string, paragraphIndex: number): string {
  return `b-${chapterId}-p${paragraphIndex}`
}

/** Paragraph index from `b-{chapterId}-p{n}`; last `-p\\d+` wins. */
export function readerParagraphIndexFromBlockId(blockId: string): number | null {
  const m = /-p(\d+)$/.exec(blockId)
  if (!m) return null
  const n = parseInt(m[1]!, 10)
  return Number.isNaN(n) ? null : n
}
