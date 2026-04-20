/**
 * List titles in the communal reader shelf (GET /api/reader/communal).
 * Evaluates what is stored for all devices when Supabase (Superbase) communal mode is on.
 * With no backend: expect 503 and IndexedDB (Indexed Database API) holds data instead (not visible here).
 *
 * Usage: npx tsx scripts/reader-communal-summarize.ts
 */

const smokeBase = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

async function main() {
  const url = `${smokeBase}/api/reader/communal`
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  console.log('GET', url)
  console.log('status', res.status)
  try {
    const data = JSON.parse(text) as unknown
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] && 'title' in data[0]) {
      console.table(
        (data as { title: string; chapterCount?: number; totalWords?: number; updatedAt?: string }[]).map((row) => ({
          title: row.title,
          chapters: row.chapterCount,
          words: row.totalWords,
          updated: row.updatedAt?.slice(0, 19),
        })),
      )
      console.log('count', data.length)
    } else {
      console.log(JSON.stringify(data, null, 2))
    }
  } catch {
    console.log(text.slice(0, 800))
  }
}

void main()

export {}
