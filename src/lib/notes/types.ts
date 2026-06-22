export type TriggerType = 'line' | 'section'

export type { KnowledgeDomainId } from './knowledge/registry'

export type NoteKind = 'IC' | 'GP' | 'internal' | 'other' | 'learning' | 'meeting'

export interface NoteMetadata {
  meetingAt?: string
  kind?: NoteKind
  /** Override auto domain inference for AI context */
  domain?: import('./knowledge/registry').KnowledgeDomainId
}

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
  tags: string[]
  metadata?: NoteMetadata
  lookups: Lookup[]
  screenshots: Record<string, Screenshot>
  startedAt: string
  updatedAt: string
}

export interface TriggerResult {
  type: TriggerType
  query: string
  context: string
  matchStart: number
  matchEnd: number
  fireKey: string
}

export interface GlossaryEntry {
  term: string
  definition: string
  sourceNoteId: string
  sourceLookupId: string
  updatedAt: string
  useCount: number
}

export interface NoteSource {
  id: string
  title: string
  kind: 'paste' | 'upload' | 'url'
  content: string
  tags: string[]
  includeInContext: boolean
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

export interface SearchHit {
  sessionId: string
  sessionTitle: string
  facet: 'body' | 'todo' | 'term' | 'chat'
  snippet: string
  lineIndex?: number
  score: number
}

export interface TodoRollupItem {
  sessionId: string
  sessionTitle: string
  meetingAt: string
  text: string
  lineIndex: number
}
