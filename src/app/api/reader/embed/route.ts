export const runtime = 'nodejs'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
}

const EMBED_MODEL = process.env.READER_EMBED_GEMINI_MODEL ?? 'text-embedding-004'

async function embedText(apiKey: string, text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(EMBED_MODEL)}:embedContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`embed ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } }
  const v = data.embedding?.values
  if (!v?.length) throw new Error('empty embedding')
  return v
}

export async function POST(req: Request) {
  const key = geminiKey()
  if (!key) {
    return Response.json({ error: 'GEMINI_API_KEY not configured', disabled: true }, { status: 501 })
  }

  let body: { query?: string; excerpts?: string[] }
  try {
    body = (await req.json()) as { query?: string; excerpts?: string[] }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  const excerpts = Array.isArray(body.excerpts) ? body.excerpts.filter((x) => typeof x === 'string').slice(0, 48) : []
  if (!query || excerpts.length === 0) {
    return Response.json({ error: 'query and non-empty excerpts[] required' }, { status: 400 })
  }

  try {
    const qVec = await embedText(key, query)
    const scores: number[] = []
    for (const ex of excerpts) {
      const dVec = await embedText(key, ex.slice(0, 2048))
      scores.push(cosineSimilarity(qVec, dVec))
    }
    return Response.json({ scores, model: EMBED_MODEL })
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'embed failed'
    return Response.json({ error: msg }, { status: 502 })
  }
}
