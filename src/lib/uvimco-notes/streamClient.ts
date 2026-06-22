import type { Message, Screenshot, TriggerType } from './types'

export async function streamLookup(params: {
  type: TriggerType
  query: string
  context: string
  conversation?: Message[]
  screenshots?: Screenshot[]
  mode?: 'lookup' | 'followup' | 'decode'
  followUpQuestion?: string
  onToken: (token: string) => void
  onDone: () => void
  onError: (msg: string) => void
}): Promise<void> {
  let failed = false

  const res = await fetch('/api/uvimco-notes/lookup', {
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
    }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    failed = true
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
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
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

  if (!failed) params.onDone()
}
