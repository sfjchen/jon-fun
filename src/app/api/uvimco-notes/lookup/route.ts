import { NextRequest, NextResponse } from 'next/server'
import {
  buildLookupParts,
  geminiApiKey,
  openRouterApiKey,
  resolveModel,
  resolveSystem,
  streamGemini,
  streamOpenRouter,
} from '@/lib/uvimco-notes/llm'
import type { Message, Screenshot, TriggerType } from '@/lib/uvimco-notes/types'

export const runtime = 'nodejs'

type LookupBody = {
  type?: TriggerType
  query?: string
  context?: string
  conversation?: Message[]
  screenshots?: Screenshot[]
  mode?: 'lookup' | 'followup' | 'decode'
  followUpQuestion?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LookupBody
    const type = body.type ?? 'word'
    const query = body.query?.trim()
    const context = body.context ?? ''
    const conversation = Array.isArray(body.conversation) ? body.conversation : []
    const screenshots = Array.isArray(body.screenshots) ? body.screenshots : []
    const mode = body.mode ?? 'lookup'

    if (!query) {
      return NextResponse.json({ error: 'query required' }, { status: 400 })
    }

    const orKey = openRouterApiKey()
    const gKey = geminiApiKey()
    if (!orKey && !gKey) {
      return NextResponse.json(
        {
          error:
            'No AI key: set OPENROUTER_API_KEY or GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY on the server.',
        },
        { status: 503 },
      )
    }

    const system = resolveSystem(mode)
    const model = resolveModel(mode, screenshots.length > 0)
    const maxTokens = mode === 'decode' ? 800 : 280
    const userParts = buildLookupParts(type, query, context, screenshots, mode, body.followUpQuestion)

    const provider = (process.env.UVIMCO_NOTES_LLM_PROVIDER ?? '').toLowerCase()
    const preferGemini = provider === 'google' || (provider !== 'openrouter' && gKey && !orKey)

    if (preferGemini && gKey) {
      const geminiModel = model.includes('/') ? model.split('/').pop()! : model
      return streamGemini(gKey, geminiModel, system, conversation, userParts, maxTokens)
    }
    if (orKey) {
      return streamOpenRouter(orKey, model, system, conversation, userParts, maxTokens)
    }
    const geminiModel = model.includes('/') ? model.split('/').pop()! : model
    return streamGemini(gKey!, geminiModel, system, conversation, userParts, maxTokens)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
