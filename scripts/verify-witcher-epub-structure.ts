/**
 * Assert *The Last Wish* Calibre fixture spine merge + story titles; optionally ask Gemini
 * to sanity-check the chapter list (set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY).
 *
 * Usage: npx tsx scripts/verify-witcher-epub-structure.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractEpubFromBuffer } from '../src/lib/reader/epub-extract-server'

const FIXTURE = join(
  process.cwd(),
  'e2e/fixtures/Witcher 1 The Last Wish (Andrzej Sapkowski) (z-library.sk, 1lib.sk, z-lib.sk).epub',
)

const EXPECTED_STORY_TITLES = [
  'The Witcher',
  'A Grain of Truth',
  'The Lesser Evil',
  'A Question of Price',
  'The Edge of the World',
  'The Last Wish',
] as const

function loadEnvLocal(): void {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}

async function maybeGeminiAudit(titles: string[]): Promise<void> {
  loadEnvLocal()
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) {
    console.log('SKIP Gemini audit (no GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY in env or .env.local).')
    return
  }
  const model = process.env.READER_CHAPTER_GEMINI_MODEL ?? 'gemini-2.5-flash'
  const prompt = `Check an EPUB table-of-contents for Andrzej Sapkowski "The Last Wish" after import.
The list may include front matter (Copyright, Contents, Preface) and back matter (Meet the Author, publisher blurb). That is normal.

Main requirement: these six story titles must appear exactly once each, in this order (ignoring front/back matter):
The Witcher → A Grain of Truth → The Lesser Evil → A Question of Price → The Edge of the World → The Last Wish

Also expect a closing frame section titled like "7: THE VOICE OF REASON" after the last story.

Chapters:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Answer in compact JSON only: {"ok":true or false,"issues":[] or short strings}`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  })
  const raw = await res.text()
  if (!res.ok) {
    console.warn('Gemini audit HTTP', res.status, raw.slice(0, 400))
    return
  }
  try {
    const data = JSON.parse(raw) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    console.log('Gemini audit:', trimmed)
    const m = /\{[\s\S]*\}/.exec(trimmed)
    if (m) {
      try {
        const verdict = JSON.parse(m[0]) as { ok?: boolean; issues?: string[] }
        if (verdict.ok === false) {
          console.warn('Gemini flagged issues:', verdict.issues ?? '(none listed)')
        }
      } catch {
        /* non-JSON prose is OK */
      }
    }
  } catch {
    console.warn('Gemini audit: could not parse response:', raw.slice(0, 500))
  }
}

async function main(): Promise<void> {
  if (!existsSync(FIXTURE)) {
    console.error('Missing fixture:', FIXTURE)
    process.exit(1)
  }
  const buf = readFileSync(FIXTURE)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const { chapters, notes } = extractEpubFromBuffer(ab)

  if (chapters.length !== 12) {
    console.error('Expected 12 spine sections after merge, got', chapters.length)
    process.exit(1)
  }
  const mergedNote = notes.some((n) => /Merged \d+ Calibre-style/.test(n))
  if (!mergedNote) {
    console.error('Expected Calibre merge note in import notes.')
    process.exit(1)
  }

  const titles = chapters.map((c) => c.title)
  const body = titles.slice(3, 9)
  for (let i = 0; i < EXPECTED_STORY_TITLES.length; i++) {
    const want = EXPECTED_STORY_TITLES[i]
    const got = body[i]
    if (got !== want) {
      console.error(`Story title mismatch at ${i}: want ${want}, got ${got}`)
      console.error('Full list:', titles)
      process.exit(1)
    }
  }
  if (!/^7:\s*THE VOICE OF REASON$/i.test(titles[9] ?? '')) {
    console.error('Expected closing frame "7: THE VOICE OF REASON", got:', titles[9])
    process.exit(1)
  }

  console.log('OK Witcher fixture structure:', titles.join(' | '))
  await maybeGeminiAudit(titles)
}

void main()
