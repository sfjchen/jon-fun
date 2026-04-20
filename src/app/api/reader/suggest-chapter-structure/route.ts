import {
  buildSuggestPayload,
  clampFormatNotes,
  clampMerges,
  clampSplitChapters,
  extractJsonFromAssistantText,
  GEMINI_CHAPTER_STRUCTURE_SCHEMA,
  type IncomingSuggestBody,
  SUGGEST_SYSTEM_PROMPT,
} from '@/lib/reader/suggest-chapter-structure-llm'

export const runtime = 'nodejs'

const MAX_CHAPTERS = 96
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** Google AI Studio / Gemini API key (not OpenRouter). */
function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
}

function openRouterApiKey(): string | undefined {
  return process.env.READER_CHAPTER_LLM_KEY ?? process.env.OPENROUTER_API_KEY
}

/**
 * When unset: use Google if `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` is set, else OpenRouter.
 * Override: `READER_CHAPTER_LLM_PROVIDER=google` | `openrouter`
 */
function provider(): 'google' | 'openrouter' {
  const p = (process.env.READER_CHAPTER_LLM_PROVIDER ?? '').toLowerCase()
  if (p === 'google') return 'google'
  if (p === 'openrouter') return 'openrouter'
  return geminiApiKey() ? 'google' : 'openrouter'
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  site: string,
  userJson: string,
): Promise<{ text: string; model: string }> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': site,
      'X-Title': 'Jon-fun reader chapter structure',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 3072,
      messages: [
        { role: 'system', content: SUGGEST_SYSTEM_PROMPT },
        { role: 'user', content: userJson },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenRouter error ${res.status}: ${errText.slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty OpenRouter response.')
  return { text: content, model }
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  error?: { message?: string; status?: string; code?: number }
}

async function callGoogleGeminiOnce(
  apiKey: string,
  model: string,
  userJson: string,
  useResponseSchema: boolean,
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    maxOutputTokens: 3072,
    responseMimeType: 'application/json',
  }
  if (useResponseSchema) {
    generationConfig.responseSchema = GEMINI_CHAPTER_STRUCTURE_SCHEMA
  }

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SUGGEST_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userJson }] }],
      generationConfig,
    }),
  })
}

async function callGoogleGemini(apiKey: string, model: string, userJson: string): Promise<{ text: string; model: string }> {
  const allowSchema = (process.env.READER_CHAPTER_GEMINI_JSON_SCHEMA ?? '1') !== '0'

  let res = await callGoogleGeminiOnce(apiKey, model, userJson, allowSchema)
  let rawText = await res.text()

  if (!res.ok && allowSchema && res.status === 400) {
    const retry = await callGoogleGeminiOnce(apiKey, model, userJson, false)
    rawText = await retry.text()
    res = retry
  }

  let data: GeminiGenerateResponse
  try {
    data = JSON.parse(rawText) as GeminiGenerateResponse
  } catch {
    throw new Error(`Gemini invalid response (${res.status}): ${rawText.slice(0, 400)}`)
  }

  if (!res.ok) {
    const msg = data.error?.message ?? rawText.slice(0, 500)
    throw new Error(`Gemini error ${res.status}: ${msg}`)
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text.trim()) {
    const reason = data.candidates?.[0]?.finishReason ?? 'unknown'
    throw new Error(`Empty Gemini response (finish: ${reason}).`)
  }
  return { text, model }
}

export async function POST(req: Request) {
  const useGoogle = provider() === 'google'
  const gKey = geminiApiKey()
  const orKey = openRouterApiKey()

  if (useGoogle && !gKey) {
    return Response.json(
      {
        error:
          'Google Gemini selected but no key: set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY (server). Or set READER_CHAPTER_LLM_PROVIDER=openrouter and OPENROUTER_API_KEY.',
        disabled: true,
      },
      { status: 501 },
    )
  }
  if (!useGoogle && !orKey) {
    return Response.json(
      {
        error:
          'No API key: set GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY (Google) or READER_CHAPTER_LLM_KEY / OPENROUTER_API_KEY (OpenRouter). Heuristic suggestions still run in the browser.',
        disabled: true,
      },
      { status: 501 },
    )
  }

  let body: IncomingSuggestBody
  try {
    body = (await req.json()) as IncomingSuggestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body?.chapters?.length || typeof body.bookTitle !== 'string') {
    return Response.json({ error: 'Expected bookTitle and non-empty chapters[].' }, { status: 400 })
  }

  const truncated =
    body.chapters.length > MAX_CHAPTERS ? body.chapters.slice(0, MAX_CHAPTERS) : body.chapters
  const truncatedNote =
    body.chapters.length > MAX_CHAPTERS
      ? `Only the first ${MAX_CHAPTERS} chapters were sent to the model (book has ${body.chapters.length}).`
      : null

  const userPayload = buildSuggestPayload(truncated, body)
  const userJson = JSON.stringify(userPayload)

  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  let modelLabel: string
  let content: string

  const flashModel = process.env.READER_CHAPTER_GEMINI_MODEL ?? 'gemini-2.5-flash'
  const escalationModel = process.env.READER_CHAPTER_GEMINI_ESCALATION_MODEL ?? 'gemini-2.5-pro'

  try {
    if (useGoogle) {
      try {
        const out = await callGoogleGemini(gKey!, flashModel, userJson)
        content = out.text
        modelLabel = out.model
      } catch (firstErr) {
        if ((process.env.READER_CHAPTER_GEMINI_ESCALATE ?? '1') === '0') throw firstErr
        const out = await callGoogleGemini(gKey!, escalationModel, userJson)
        content = out.text
        modelLabel = `${out.model} (escalated)`
      }
    } else {
      modelLabel = process.env.READER_CHAPTER_LLM_MODEL ?? 'openai/gpt-4o-mini'
      const out = await callOpenRouter(orKey!, modelLabel, site, userJson)
      content = out.text
      modelLabel = out.model
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'LLM request failed.'
    return Response.json({ error: message }, { status: 502 })
  }

  let parsed: unknown
  try {
    parsed = extractJsonFromAssistantText(content)
  } catch {
    return Response.json({ error: 'Model did not return parseable JSON.', raw: content.slice(0, 800) }, { status: 502 })
  }

  const chapterCount = truncated.length
  const paraCounts = truncated.map((c) => c.paragraphCount)
  const { merges, notes: mergeNotes } = clampMerges(parsed, chapterCount)
  const { splits, notes: splitClampNotes } = clampSplitChapters(parsed, chapterCount, paraCounts)
  const formatNotes = clampFormatNotes(parsed)
  const structuralNotes = [...mergeNotes, ...splitClampNotes, ...(truncatedNote ? [truncatedNote] : [])]

  return Response.json({
    merges: merges.map((m) => ({ ...m, kind: 'llm' as const })),
    splitChapters: splits.map((s) => ({ ...s, kind: 'llm' as const })),
    notes: structuralNotes,
    formatNotes,
    model: modelLabel,
    provider: useGoogle ? 'google' : 'openrouter',
  })
}
