import { extractEpubFromBuffer } from '@/lib/reader/epub-extract-server'

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')

  if (!(file instanceof File)) {
    return Response.json({ error: 'Expected multipart field "file" (EPUB).' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: `EPUB too large (max ${MAX_BYTES / (1024 * 1024)} MB).` }, { status: 413 })
  }

  const type = (file.type || '').toLowerCase()
  const name = file.name || ''
  const okType = !type || type === 'application/epub+zip' || type === 'application/x-epub+zip'
  const okExt = /\.epub$/i.test(name)
  if (type && !okType && !okExt) {
    return Response.json({ error: 'Only application/epub+zip (or .epub) is supported.' }, { status: 415 })
  }

  const buf = await file.arrayBuffer()
  const head = new Uint8Array(buf.slice(0, 4))
  const isZip = head[0] === 0x50 && head[1] === 0x4b
  if (!isZip) {
    return Response.json({ error: 'File does not look like a ZIP (EPUB) archive.' }, { status: 400 })
  }

  try {
    const { packageTitle, chapters, notes } = extractEpubFromBuffer(buf)
    return Response.json({ packageTitle, chapters, notes })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'EPUB extraction failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
