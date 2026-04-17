import { installNodePdfPolyfills } from '@/lib/reader/node-pdf-polyfill'
import { normalizePdfTextArtifacts, paragraphize } from '@/lib/reader/pdf-reflow'

installNodePdfPolyfills()

/**
 * Server-side PDF text extraction (Node) via `pdf-parse` (embeds pdf.js).
 * Dynamic import + `serverExternalPackages` avoids Next/webpack breaking the pdf-parse bundle.
 */
export async function extractPdfTextFromBuffer(buffer: ArrayBuffer): Promise<{ text: string; notes: string[] }> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const textResult = await parser.getText()
    const linesByPage = textResult.pages.map((p) => p.text.split('\n').map((l) => l.trim()).filter(Boolean))
    const notes: string[] = [
      'PDF import reflows extracted text into a reader layout. Tables, multi-column layouts, headers, footers, and footnotes may need cleanup.',
    ]
    notes.push(`Extracted ${textResult.total} PDF pages into reflowed reader text.`)
    return {
      text: normalizePdfTextArtifacts(paragraphize(linesByPage)),
      notes,
    }
  } finally {
    await parser.destroy()
  }
}
