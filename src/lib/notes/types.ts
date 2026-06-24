export type TriggerType = 'line' | 'section'

export type { KnowledgeDomainId } from './knowledge/registry'

export type NoteKind = 'IC' | 'GP' | 'internal' | 'other' | 'learning' | 'meeting'

export type NoteHistoryKind =
  | 'created'
  | 'saved'
  | 'synced'
  | 'lookup'
  | 'title'
  | 'tags'
  | 'switch'

export interface NoteHistoryEntry {
  kind: NoteHistoryKind
  at: string
  detail?: string
}

export interface NoteMetadata {
  /** @deprecated use startedAt; kept for legacy sessions */
  meetingAt?: string
  /** @deprecated kind merged into tags */
  kind?: NoteKind
  /** Auto-inferred domain id (never user-picked) */
  inferredDomain?: import('./knowledge/registry').KnowledgeDomainId
  /** Vault folder id; omit = Inbox */
  folderId?: string | null
  /** Source ids excluded from AI context for this note (default: all included) */
  excludedSourceIds?: string[]
}

export interface NoteFolder {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  createdAt: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface AttachmentDisplay {
  widthPx?: number
  heightPx?: number
  /** Normalized crop rect for images (0–1). */
  crop?: { x: number; y: number; w: number; h: number }
}

export interface SpreadsheetPreview {
  sheetName: string
  headers: string[]
  rows: string[][]
  totalRows: number
  totalCols: number
}

export type AttachmentKind = 'image' | 'spreadsheet' | 'document' | 'file'

export interface Screenshot {
  id: string
  base64: string
  mimeType: string
  filename?: string
  kind?: AttachmentKind
  preview?: SpreadsheetPreview
  display?: AttachmentDisplay
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
  history?: NoteHistoryEntry[]
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
  /** When true, built-in pack body is not overwritten by registry refresh */
  userEdited?: boolean
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
