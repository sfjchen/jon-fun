/** Shared Gemini text embeddings — used by Reader search and Notes RAG context. */

export function cosineSimilarity(a: number[], b: number[]): number {
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

export function geminiEmbedKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
}

export function embedModel(): string {
  return process.env.NOTES_EMBED_GEMINI_MODEL ?? process.env.READER_EMBED_GEMINI_MODEL ?? 'gemini-embedding-001'
}

export async function embedText(apiKey: string, text: string, model = embedModel()): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text: text.slice(0, 2048) }] },
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

export async function rankExcerptsByQuery(
  apiKey: string,
  query: string,
  excerpts: string[],
  model?: string,
): Promise<number[]> {
  const qVec = await embedText(apiKey, query, model)
  const scores: number[] = []
  for (const ex of excerpts) {
    const dVec = await embedText(apiKey, ex, model)
    scores.push(cosineSimilarity(qVec, dVec))
  }
  return scores
}
