export const runtime = 'nodejs'

import { embedModel, geminiEmbedKey, rankExcerptsByQuery } from '@/lib/embed/gemini'
import { assertNotesAiAccess } from '@/lib/sfjc-sync-auth'

export async function POST(req: Request) {
  const key = geminiEmbedKey()
  if (!key) {
    return Response.json({ error: 'GEMINI_API_KEY not configured', disabled: true }, { status: 501 })
  }

  let body: { query?: string; excerpts?: string[]; syncPassword?: string; deviceUserId?: string }
  try {
    body = (await req.json()) as { query?: string; excerpts?: string[]; syncPassword?: string; deviceUserId?: string }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const denied = assertNotesAiAccess(body.syncPassword)
  if (denied) {
    return Response.json({ error: denied }, { status: 403 })
  }

  const query = typeof body.query === 'string' ? body.query.trim() : ''
  const excerpts = Array.isArray(body.excerpts) ? body.excerpts.filter((x) => typeof x === 'string').slice(0, 48) : []
  if (!query || excerpts.length === 0) {
    return Response.json({ error: 'query and non-empty excerpts[] required' }, { status: 400 })
  }

  try {
    const model = embedModel()
    const scores = await rankExcerptsByQuery(key, query, excerpts, model)
    return Response.json({ scores, model })
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'embed failed'
    return Response.json({ error: msg }, { status: 502 })
  }
}
