import type { ReaderSourceType } from '@/lib/reader/types'

export const runtime = 'nodejs'

const MAX_CHAPTERS = 96
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

type IncomingBody = {
  bookTitle: string
  sourceType: ReaderSourceType
  originalFileName?: string | null
  chapters: {
    index: number
    title: string
    wordCount: number
    paragraphCount: number
    excerptHead: string
    excerptTail?: string
  }[]
}

type LlmMerge = { startIndex: number; endIndex: number; reason: string }

function clampMerges(raw: unknown, chapterCount: number): { merges: LlmMerge[]; notes: string[] } {
  if (!raw || typeof raw !== 'object') return { merges: [], notes: ['LLM returned no object.'] }
  const o = raw as { merges?: unknown; notes?: unknown }
  const notes = Array.isArray(o.notes) ? o.notes.filter((n) => typeof n === 'string').map(String) : []
  const mergesIn = o.merges
  if (!Array.isArray(mergesIn)) return { merges: [], notes }

  const merges: LlmMerge[] = []
  for (const item of mergesIn) {
    if (!item || typeof item !== 'object') continue
    const it = item as { startIndex?: unknown; endIndex?: unknown; reason?: unknown }
    if (typeof it.startIndex !== 'number' || typeof it.endIndex !== 'number') continue
    const startIndex = Math.floor(it.startIndex)
    const endIndex = Math.floor(it.endIndex)
    if (
      startIndex < 0 ||
      endIndex < 0 ||
      startIndex >= chapterCount ||
      endIndex >= chapterCount ||
      endIndex <= startIndex
    ) {
      continue
    }
    merges.push({
      startIndex,
      endIndex,
      reason: typeof it.reason === 'string' ? it.reason : 'Model suggestion',
    })
  }
  return { merges, notes }
}

function extractJsonFromAssistantText(text: string): unknown {
  const t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t)
  const raw = fence ? fence[1]!.trim() : t
  return JSON.parse(raw) as unknown
}

export async function POST(req: Request) {
  const apiKey = process.env.READER_CHAPTER_LLM_KEY ?? process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return Response.json(
      {
        error:
          'No API key: set READER_CHAPTER_LLM_KEY or OPENROUTER_API_KEY for AI chapter hints. Heuristic suggestions still run in the browser.',
        disabled: true,
      },
      { status: 501 },
    )
  }

  let body: IncomingBody
  try {
    body = (await req.json()) as IncomingBody
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

  const model = process.env.READER_CHAPTER_LLM_MODEL ?? 'openai/gpt-4o-mini'
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const userPayload = {
    bookTitle: body.bookTitle,
    sourceType: body.sourceType,
    originalFileName: body.originalFileName,
    chapters: truncated,
    instruction:
      'Indices are 0-based. Only suggest merging CONSECUTIVE chapters (startIndex..endIndex inclusive on the right). Prefer merging only when excerpts clearly look like front matter, legal boilerplate, TOC fragments, or empty spine noise — not real story chapters. When unsure, suggest nothing. Return strict JSON: { "merges": [ { "startIndex": number, "endIndex": number, "reason": string } ], "notes": string[] }',
  }

  const system =
    'You help fix e-reader imports. You only output valid JSON. Be conservative: false negatives are better than merging real chapters.'

  try {
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
        max_tokens: 2000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return Response.json(
        { error: `OpenRouter error ${res.status}`, detail: errText.slice(0, 500) },
        { status: 502 },
      )
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return Response.json({ error: 'Empty model response.' }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = extractJsonFromAssistantText(content)
    } catch {
      return Response.json({ error: 'Model did not return parseable JSON.', raw: content.slice(0, 800) }, { status: 502 })
    }

    const chapterCount = truncated.length
    const { merges, notes } = clampMerges(parsed, chapterCount)
    const allNotes = [...notes, ...(truncatedNote ? [truncatedNote] : [])]

    return Response.json({
      merges: merges.map((m) => ({ ...m, kind: 'llm' as const })),
      notes: allNotes,
      model,
    })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'LLM request failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
