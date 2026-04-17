import { extractPdfTextFromBuffer } from '@/lib/reader/pdf-extract-server'

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')

  if (!(file instanceof File)) {
    return Response.json({ error: 'Expected multipart field "file" (PDF).' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: `PDF too large (max ${MAX_BYTES / (1024 * 1024)} MB).` }, { status: 413 })
  }

  const type = file.type || ''
  if (type && type !== 'application/pdf') {
    return Response.json({ error: 'Only application/pdf is supported.' }, { status: 415 })
  }

  const buf = await file.arrayBuffer()
  const head = new Uint8Array(buf.slice(0, 5))
  const isPdfHeader = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d
  if (!isPdfHeader) {
    return Response.json({ error: 'File does not look like a PDF (%PDF- header missing).' }, { status: 400 })
  }

  try {
    const { text, notes } = await extractPdfTextFromBuffer(buf)
    return Response.json({ text, notes })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'PDF extraction failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
