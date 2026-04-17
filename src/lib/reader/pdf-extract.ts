type PdfModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

type PositionedItem = {
  text: string
  x: number
  y: number
}

let cachedPdfModule: Promise<PdfModule> | null = null

async function loadPdfModule(): Promise<PdfModule> {
  if (!cachedPdfModule) {
    cachedPdfModule = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
      }
      return pdfjs
    })
  }

  return cachedPdfModule
}

function bucketLines(items: PositionedItem[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PositionedItem[][] = []

  for (const item of sorted) {
    const line = lines.find((candidate) => candidate[0] != null && Math.abs(candidate[0]!.y - item.y) < 3)
    if (line) line.push(item)
    else lines.push([item])
  }

  return lines
    .map((line) => line.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function paragraphize(linesByPage: string[][]): string {
  const pages: string[] = []

  for (const lines of linesByPage) {
    const cleaned: string[] = []
    let current = ''

    for (const line of lines) {
      const isLikelyHeader = /^page\s+\d+$/i.test(line) || /^\d+$/.test(line)
      if (isLikelyHeader) continue

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

export async function extractPdfText(file: File): Promise<{ text: string; notes: string[] }> {
  const pdfjs = await loadPdfModule()
  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: buffer })
  const pdf = await loadingTask.promise
  const notes: string[] = [
    'PDF import reflows extracted text into a reader layout. Tables, multi-column layouts, headers, footers, and footnotes may need cleanup.',
  ]
  const linesByPage: string[][] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = content.items
      .filter((item): boolean => typeof item === 'object' && item !== null && 'str' in item && 'transform' in item)
      .map((item) => {
        const t = item as { str: string; transform: number[] }
        return {
          text: t.str.trim(),
          x: t.transform[4] ?? 0,
          y: t.transform[5] ?? 0,
        }
      })
      .filter((item) => item.text)

    linesByPage.push(bucketLines(items))
  }

  notes.push(`Extracted ${pdf.numPages} PDF pages into reflowed reader text.`)
  return {
    text: paragraphize(linesByPage),
    notes,
  }
}
