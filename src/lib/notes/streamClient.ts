import type { KnowledgeDomainId } from './knowledge/registry'
import { notesSyncCredentials } from './syncCredentials'
import type { Message, Screenshot, TriggerType } from './types'

export async function streamLookup(params: {
  type: TriggerType
  query: string
  context: string
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
  onToken: (token: string) => void
  onDone: () => void
  onError: (msg: string) => void
}): Promise<void> {
  let failed = false
  let finished = false

  const finish = () => {
    if (finished || failed) return
    finished = true
    params.onDone()
  }

  const parseChunk = (chunk: string) => {
    for (const part of chunk.split('\n\n')) {
      if (!part.trim()) continue
      for (const line of part.split('\n')) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') {
          finish()
          continue
        }
        try {
          const json = JSON.parse(payload) as { token?: string; error?: string }
          if (json.error) {
            failed = true
            params.onError(json.error)
          }
          if (json.token) params.onToken(json.token)
        } catch {
          /* skip */
        }
      }
    }
  }

  const creds = notesSyncCredentials()
  const res = await fetch('/api/notes/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: params.type,
      query: params.query,
      context: params.context,
      conversation: params.conversation ?? [],
      screenshots: params.screenshots ?? [],
      mode: params.mode ?? 'lookup',
      followUpQuestion: params.followUpQuestion,
      glossaryBlock: params.glossaryBlock,
      sourcesBlock: params.sourcesBlock,
      relatedNotesBlock: params.relatedNotesBlock,
      noteTags: params.noteTags,
      noteDomain: params.noteDomain,
      fullNotes: params.fullNotes,
      title: params.title,
      syncPassword: creds.syncPassword,
      deviceUserId: creds.deviceUserId,
    }),
  })

  if (!res.ok) {
    failed = true
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    params.onError(err?.error ?? `Request failed (${res.status})`)
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    failed = true
    params.onError('No response stream')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: !done })
    if (buffer) {
      const parts = buffer.split('\n\n')
      buffer = done ? '' : (parts.pop() ?? '')
      parseChunk(parts.join('\n\n'))
    }
    if (done) {
      if (buffer.trim()) parseChunk(buffer)
      break
    }
  }

  finish()
}
