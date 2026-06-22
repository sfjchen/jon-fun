export type TriggerType = 'word' | 'line'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Screenshot {
  id: string
  base64: string
  mimeType: string
}

export interface Lookup {
  id: string
  type: TriggerType
  query: string
  context: string
  conversation: Message[]
  triggeredAt: string
  screenshotIds?: string[]
}

export interface NoteSession {
  id: string
  title: string
  notes: string
  lookups: Lookup[]
  screenshots: Record<string, Screenshot>
  startedAt: string
  updatedAt: string
}

export interface TriggerResult {
  type: TriggerType
  query: string
  matchStart: number
  matchEnd: number
}
