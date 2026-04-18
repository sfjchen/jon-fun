/**
 * EPUB extraction in the browser: delegates to `/api/reader/extract-epub` (Node).
 * Package is not stored server-side; returns spine sections as plain-text paragraphs.
 */
export type EpubExtractResponse = {
  packageTitle: string
  chapters: { title: string; paragraphs: string[] }[]
  notes: string[]
}

export async function extractEpub(file: File): Promise<EpubExtractResponse> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/reader/extract-epub', {
    method: 'POST',
    body: fd,
  })

  if (!res.ok) {
    let message = 'Could not read this EPUB.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  return (await res.json()) as EpubExtractResponse
}
