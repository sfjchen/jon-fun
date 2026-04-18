import { isStructuredChapterHeadingLine } from '@/lib/reader/text-chapters'

export type PdfPositionedItem = {
  text: string
  x: number
  y: number
}

export function bucketLines(items: PdfPositionedItem[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PdfPositionedItem[][] = []

  for (const item of sorted) {
    const line = lines.find((candidate) => candidate[0] != null && Math.abs(candidate[0]!.y - item.y) < 3)
    if (line) line.push(item)
    else lines.push([item])
  }

  return lines
    .map((line) => line.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Common pdf.js text-run splits (e.g. “B” + “ook” → line “B ook 2”). */
export function normalizePdfTextArtifacts(text: string): string {
  return text.replace(/\bB\s+ook\b/gi, 'Book')
}

export function paragraphize(linesByPage: string[][]): string {
  const pages: string[] = []

  for (const lines of linesByPage) {
    const cleaned: string[] = []
    let current = ''

    for (const line of lines) {
      const isLikelyHeader = /^page\s+\d+$/i.test(line) || /^\d+$/.test(line)
      if (isLikelyHeader) continue

      const trimmed = line.trim()
      if (isStructuredChapterHeadingLine(trimmed) && current.trim()) {
        cleaned.push(current.trim())
        current = trimmed
        continue
      }

      if (current.trim().length > 720) {
        const sp = current.lastIndexOf(' ', 560)
        if (sp > 280) {
          cleaned.push(current.slice(0, sp).trim())
          current = current.slice(sp + 1).trim()
        }
      }

      const endsSentence = /[.!?:"']$/.test(line)
      const nextParagraphBreak = current.length > 0 && endsSentence
      current = current ? `${current} ${line}` : line

      if (nextParagraphBreak) {
        cleaned.push(current.trim())
        current = ''
      }
    }

    if (current.trim()) cleaned.push(current.trim())
    pages.push(cleaned.join('\n\n'))
  }

  return pages.join('\n\n')
}
