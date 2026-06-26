import { NextRequest, NextResponse } from 'next/server'
import {
  buildLookupParts,
  geminiApiKey,
  openRouterApiKey,
  resolveSystem,
  streamLookupWithFallback,
} from '@/lib/notes/llm'
import type { KnowledgeDomainId } from '@/lib/notes/knowledge/registry'
import { assertNotesAiAccess } from '@/lib/sfjc-sync-auth'
import type { Message, Screenshot, TriggerType } from '@/lib/notes/types'

export const runtime = 'nodejs'

type LookupBody = {
  type?: TriggerType
  query?: string
  context?: string
  conversation?: Message[]
  screenshots?: Screenshot[]
  mode?: 'lookup' | 'followup' | 'decode' | 'agent'
  followUpQuestion?: string
  title?: string
  glossaryBlock?: string
  sourcesBlock?: string
  relatedNotesBlock?: string
  noteTags?: string[]
  noteDomain?: KnowledgeDomainId
  fullNotes?: string
  syncPassword?: string
  deviceUserId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LookupBody
    const type = body.type ?? 'line'
    const query = body.query?.trim()
    const context = body.context ?? ''
    const conversation = Array.isArray(body.conversation) ? body.conversation : []
    const screenshots = Array.isArray(body.screenshots) ? body.screenshots : []
    const mode = body.mode ?? 'lookup'

    if (!query) {
      return NextResponse.json({ error: 'query required' }, { status: 400 })
    }

    const denied = assertNotesAiAccess(body.syncPassword, body.deviceUserId)
    if (denied) {
      return NextResponse.json({ error: denied }, { status: 403 })
    }

    if (!openRouterApiKey() && !geminiApiKey()) {
      return NextResponse.json(
        {
          error:
            'No AI key: set OPENROUTER_API_KEY or GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY on the server.',
        },
        { status: 503 },
      )
    }

    const promptCtx: import('@/lib/notes/llm').PromptContext = {
      sourcesBlock: body.sourcesBlock ?? '',
      glossaryBlock: body.glossaryBlock ?? '',
      relatedNotesBlock: body.relatedNotesBlock ?? '',
    }
    if (body.noteDomain) promptCtx.domainId = body.noteDomain
    if (body.noteTags?.length) promptCtx.tags = body.noteTags
    if (body.fullNotes) promptCtx.fullNotes = body.fullNotes
    if (body.title) promptCtx.title = body.title

    const system = resolveSystem(mode, type, promptCtx, query)
    const maxTokens =
      mode === 'decode' ? 800 : mode === 'agent' || mode === 'followup' ? 1200 : type === 'section' ? 400 : 360
    const userParts = buildLookupParts(type, query, context, screenshots, mode, body.followUpQuestion)

    return streamLookupWithFallback(mode, screenshots.length > 0, {
      system,
      conversation,
      userParts,
      maxTokens,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
