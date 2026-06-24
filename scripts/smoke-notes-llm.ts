/**
 * Smoke-test Notes LLM backends/models. Never prints API keys.
 *
 *   npx tsx scripts/smoke-notes-llm.ts
 *   SMOKE_BASE_URL=https://sfjc.dev npx tsx scripts/smoke-notes-llm.ts
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvLocal()

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'
const orKey = process.env.UVIMCO_NOTES_LLM_KEY ?? process.env.OPENROUTER_API_KEY
const gKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY

type Case = { label: string; run: () => Promise<{ ok: boolean; detail: string }> }

async function testDeployRoute(mode: 'line' | 'section'): Promise<{ ok: boolean; detail: string }> {
  const syncPassword = process.env.SFJC_SYNC_PASSWORD ?? ''
  const body =
    mode === 'line'
      ? {
          type: 'line',
          query: 'MOIC',
          context: 'fund returns MOIC?',
          conversation: [],
          mode: 'lookup',
          syncPassword,
        }
      : {
          type: 'section',
          query: 'GP fee',
          context: 'LP stakes\nGP fee structure',
          conversation: [],
          mode: 'lookup',
          syncPassword,
        }
  const res = await fetch(`${base}/api/notes/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    return { ok: false, detail: `HTTP ${res.status}: ${err.slice(0, 200)}` }
  }
  const text = await res.text()
  const tokens = [...text.matchAll(/"token":"([^"]*)"/g)].map((m) => m[1]).join('')
  if (tokens.length < 8) return { ok: false, detail: `stream too short (${tokens.length} chars)` }
  if (mode === 'line' && tokens.length > 1200) return { ok: false, detail: `line mode too long (${tokens.length})` }
  return { ok: true, detail: tokens.slice(0, 80) + '…' }
}

async function testOpenRouter(model: string): Promise<{ ok: boolean; detail: string }> {
  if (!orKey) return { ok: false, detail: 'no OPENROUTER_API_KEY' }
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${orKey}`,
      'HTTP-Referer': 'https://sfjc.dev',
    },
    body: JSON.stringify({
      model,
      stream: false,
      max_tokens: 40,
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    }),
  })
  const body = await res.text()
  if (!res.ok) return { ok: false, detail: `${res.status} ${body.slice(0, 160)}` }
  return { ok: true, detail: body.slice(0, 100) + '…' }
}

async function testGemini(model: string): Promise<{ ok: boolean; detail: string }> {
  if (!gKey) return { ok: false, detail: 'no GEMINI_API_KEY' }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(gKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: ok' }] }],
      generationConfig: { maxOutputTokens: 16 },
    }),
  })
  const body = await res.text()
  if (!res.ok) return { ok: false, detail: `${res.status} ${body.slice(0, 160)}` }
  return { ok: true, detail: body.slice(0, 100) + '…' }
}

const cases: Case[] = [
  { label: `deploy route line ${base}`, run: () => testDeployRoute('line') },
  { label: `deploy route section ${base}`, run: () => testDeployRoute('section') },
  { label: 'OpenRouter google/gemini-2.5-flash-lite', run: () => testOpenRouter('google/gemini-2.5-flash-lite') },
  { label: 'OpenRouter google/gemini-2.5-flash', run: () => testOpenRouter('google/gemini-2.5-flash') },
  { label: 'OpenRouter openai/gpt-4o-mini', run: () => testOpenRouter('openai/gpt-4o-mini') },
  { label: 'Gemini direct gemini-2.5-flash-lite', run: () => testGemini('gemini-2.5-flash-lite') },
  { label: 'Gemini direct gemini-2.5-flash', run: () => testGemini('gemini-2.5-flash') },
]

async function main() {
  console.log('Keys present:', {
    openrouter: Boolean(orKey),
    gemini: Boolean(gKey),
    provider: process.env.UVIMCO_NOTES_LLM_PROVIDER ?? '(auto)',
    lookupModel: process.env.UVIMCO_NOTES_LOOKUP_MODEL ?? '(default)',
  })
  console.log('')
  for (const c of cases) {
    try {
      const r = await c.run()
      console.log(r.ok ? '✓' : '✗', c.label)
      console.log(' ', r.detail)
    } catch (e) {
      console.log('✗', c.label)
      console.log(' ', e instanceof Error ? e.message : String(e))
    }
  }
}

main()
