import { installNodePdfPolyfills } from '@/lib/reader/node-pdf-polyfill'
import { getPdfWorkerSrcForNode } from '@/lib/reader/pdf-worker-path'
import { pdfExtractIngestMeta } from '@/lib/reader/ingest-confidence'
import { normalizePdfTextArtifacts, paragraphize } from '@/lib/reader/pdf-reflow'

installNodePdfPolyfills()

export type PdfExtractMeta = {
  pageCount: number
  totalChars: number
  avgCharsPerPage: number
  scannedLikely: boolean
}

/**
 * Server-side PDF text extraction (Node) via `pdf-parse` (embeds pdf.js).
 * Dynamic import + `serverExternalPackages` avoids Next/webpack breaking the pdf-parse bundle.
 */
export async function extractPdfTextFromBuffer(buffer: ArrayBuffer): Promise<{
  text: string
  notes: string[]
  extractMeta: PdfExtractMeta
}> {
  const { PDFParse } = await import('pdf-parse')
  PDFParse.setWorker(getPdfWorkerSrcForNode())
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const textResult = await parser.getText()
    const linesByPage = textResult.pages.map((p) => p.text.split('\n').map((l) => l.trim()).filter(Boolean))
    const joined = linesByPage.map((lines) => lines.join(' ')).join('\n')
    const totalChars = joined.replace(/\s+/g, ' ').length
    const pageCount = Math.max(1, textResult.total)
    const avgCharsPerPage = totalChars / pageCount
    const scannedLikely = avgCharsPerPage < 72 && totalChars < pageCount * 100
    const extractMeta: PdfExtractMeta = {
      pageCount,
      totalChars,
      avgCharsPerPage,
      scannedLikely,
    }
    const notes: string[] = [
      'PDF import reflows extracted text into a reader layout (no AI summarization). Tables, multi-column layouts, headers, footers, and footnotes may need cleanup.',
    ]
    notes.push(`Extracted ${textResult.total} PDF pages into reflowed reader text.`)
    if (scannedLikely) {
      notes.push(
        'Low text density per page — this may be a scanned/image PDF. OCR (Optical Character Recognition) is not run in this pipeline yet; try a text-based PDF or preprocess elsewhere.',
      )
    }
    const ingestHint = pdfExtractIngestMeta(pageCount, totalChars, scannedLikely)
    notes.push(
      `Ingest heuristic: confidence ~${Math.round((ingestHint.overallConfidence ?? 0) * 100)}%${ingestHint.flags?.length ? ` (${ingestHint.flags.join(', ')})` : ''}.`,
    )
    return {
      text: normalizePdfTextArtifacts(paragraphize(linesByPage)),
      notes,
      extractMeta,
    }
  } finally {
    await parser.destroy()
  }
}
