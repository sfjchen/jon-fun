/**
 * PDF text extraction for the browser: delegates to `/api/reader/extract-pdf` (Node + pdf.js).
 * Keeps the client bundle free of pdf.js workers (brittle under Next.js) while preserving the same
 * reflow output as `pdf-extract-server.ts` + `pdf-reflow.ts`.
 */
export async function extractPdfText(file: File): Promise<{ text: string; notes: string[] }> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/reader/extract-pdf', {
    method: 'POST',
    body: fd,
  })

  if (!res.ok) {
    let message = 'Could not extract text from this PDF.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  return (await res.json()) as { text: string; notes: string[] }
}
