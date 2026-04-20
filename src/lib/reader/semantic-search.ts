import type { ReaderSearchHit } from '@/lib/reader/search-book'

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

/** Re-order lexical hits by embedding similarity to the query (server route uses Gemini). */
export async function rankSearchHitsByEmbedding(
  query: string,
  hits: ReaderSearchHit[],
  getParagraph: (h: ReaderSearchHit) => string,
): Promise<ReaderSearchHit[]> {
  if (!query.trim() || hits.length < 2) return hits
  try {
    const excerpts = hits.map((h) => getParagraph(h).slice(0, 1200))
    const res = await fetch('/api/reader/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, excerpts }),
    })
    if (!res.ok) return hits
    const data = (await res.json()) as { scores?: number[] }
    if (!Array.isArray(data.scores) || data.scores.length !== hits.length) return hits
    const scores = data.scores ?? []
    const indexed = hits.map((h, i) => ({ h, s: scores[i] ?? 0 }))
    indexed.sort((a, b) => b.s - a.s)
    return indexed.map((x) => x.h)
  } catch {
    return hits
  }
}

export { cosineSimilarity }
