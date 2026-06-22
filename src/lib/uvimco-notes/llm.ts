import { DECODE_ALL_SYSTEM, UVIMCO_SYSTEM } from './uvimcoContext'
import type { Message, Screenshot, TriggerType } from './types'

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** Fast lookups — Gemini Flash Lite class (speed + cost). */
export const DEFAULT_LOOKUP_MODEL = 'google/gemini-2.5-flash-lite'
/** Decode-all / follow-ups with screenshots — stronger but still cheap. */
export const DEFAULT_DECODE_MODEL = 'google/gemini-2.5-flash'

export function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
}

export function openRouterApiKey(): string | undefined {
  return process.env.UVIMCO_NOTES_LLM_KEY ?? process.env.OPENROUTER_API_KEY
}

export function lookupModel(): string {
  return process.env.UVIMCO_NOTES_LOOKUP_MODEL ?? DEFAULT_LOOKUP_MODEL
}

export function decodeModel(): string {
  return process.env.UVIMCO_NOTES_DECODE_MODEL ?? DEFAULT_DECODE_MODEL
}

export function siteReferer(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sfjc.dev'
}

type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export function buildUserText(
  type: TriggerType,
  query: string,
  context: string,
  mode: 'lookup' | 'followup' | 'decode',
  followUpQuestion?: string,
): string {
  if (mode === 'decode') {
    return `Full session notes:\n\n${query}\n\nSummarize per instructions.`
  }
  if (mode === 'followup' && followUpQuestion) {
    return `Follow-up on "${query}":\n${followUpQuestion}\n\nNote context:\n${context}`
  }
  if (type === 'word') {
    return `In my UVIMCO meeting notes I encountered this term: "${query}"\n\nNote context (recent lines):\n${context}\n\nPlease explain "${query}" concisely in UVIMCO/endowment context.`
  }
  return `In my UVIMCO meeting notes I wrote this line and marked it for explanation:\n"${query}"\n\nNote context:\n${context}\n\nPlease explain what this means in UVIMCO context.`
}

export function buildOpenRouterMessages(
  system: string,
  conversation: Message[],
  userParts: OpenRouterContentPart[],
): { role: string; content: OpenRouterContentPart[] | string }[] {
  const msgs: { role: string; content: OpenRouterContentPart[] | string }[] = [
    { role: 'system', content: system },
  ]
  for (const m of conversation) {
    msgs.push({ role: m.role, content: m.content })
  }
  msgs.push({ role: 'user', content: userParts })
  return msgs
}

export function screenshotParts(screenshots: Screenshot[]): OpenRouterContentPart[] {
  return screenshots.map((s) => ({
    type: 'image_url' as const,
    image_url: { url: `data:${s.mimeType};base64,${s.base64}` },
  }))
}

export function buildLookupParts(
  type: TriggerType,
  query: string,
  context: string,
  screenshots: Screenshot[],
  mode: 'lookup' | 'followup' | 'decode',
  followUpQuestion?: string,
): OpenRouterContentPart[] {
  const parts: OpenRouterContentPart[] = [...screenshotParts(screenshots)]
  parts.push({
    type: 'text',
    text: buildUserText(type, query, context, mode, followUpQuestion),
  })
  return parts
}

export async function streamOpenRouter(
  apiKey: string,
  model: string,
  system: string,
  conversation: Message[],
  userParts: OpenRouterContentPart[],
  maxTokens: number,
): Promise<Response> {
  const upstream = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': siteReferer(),
      'X-Title': 'UVIMCO Notes',
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: buildOpenRouterMessages(system, conversation, userParts),
    }),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return new Response(JSON.stringify({ error: `OpenRouter ${upstream.status}: ${errText.slice(0, 400)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const payload = trimmed.slice(5).trim()
            if (payload === '[DONE]') continue
            try {
              const json = JSON.parse(payload) as {
                choices?: { delta?: { content?: string } }[]
              }
              const token = json.choices?.[0]?.delta?.content
              if (token) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
            } catch {
              /* skip malformed chunks */
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

type GeminiPart = { text?: string } | { inlineData?: { mimeType: string; data: string } }

export async function streamGemini(
  apiKey: string,
  model: string,
  system: string,
  conversation: Message[],
  userParts: OpenRouterContentPart[],
  maxTokens: number,
): Promise<Response> {
  const contents: { role: string; parts: GeminiPart[] }[] = []
  for (const m of conversation) {
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })
  }
  const geminiUserParts: GeminiPart[] = userParts.map((p) => {
    if (p.type === 'text') return { text: p.text }
    const url = p.image_url.url
    const m = url.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) return { text: url }
    return { inlineData: { mimeType: m[1]!, data: m[2]! } }
  })
  contents.push({ role: 'user', parts: geminiUserParts })

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
    }),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return new Response(JSON.stringify({ error: `Gemini ${upstream.status}: ${errText.slice(0, 400)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            try {
              const json = JSON.parse(payload) as {
                candidates?: { content?: { parts?: { text?: string }[] } }[]
              }
              const token = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
              if (token) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
            } catch {
              /* skip */
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

export function resolveSystem(mode: 'lookup' | 'followup' | 'decode'): string {
  return mode === 'decode' ? DECODE_ALL_SYSTEM : UVIMCO_SYSTEM
}

export function resolveModel(mode: 'lookup' | 'followup' | 'decode', hasImages: boolean): string {
  if (mode === 'decode' || hasImages) return decodeModel()
  return lookupModel()
}

export { UVIMCO_SYSTEM, DECODE_ALL_SYSTEM }
