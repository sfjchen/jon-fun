import type { ConnectionsGroup, ConnectionsPuzzle, ConnectionsPuzzleSummary } from '@/lib/connections'
import {
  CONNECTIONS_MAX_BODY_CHARS,
  CONNECTIONS_SCHEMA_VERSION,
  parseConnectionsGroup,
  slugify,
  validateConnectionsPuzzleShape,
  wordKey,
} from '@/lib/connections'

export function connectionsBackendReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return Boolean(key && url && !url.includes('placeholder.supabase.co'))
}

export function connectionsPayloadTooLarge(raw: string): boolean {
  return raw.length > CONNECTIONS_MAX_BODY_CHARS
}

export type ConnectionsDbRow = {
  id: string
  slug: string
  title: string
  description: string
  groups: ConnectionsGroup[]
  tags: string[] | null
  author_display: string
  author_fingerprint: string
  play_count: number
  solve_count: number
  total_mistakes: number
  created_at: string
  updated_at: string
}

export function parseGroupsJsonb(raw: unknown): ConnectionsGroup[] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null
  const out: ConnectionsGroup[] = []
  for (const g of raw) {
    const pg = parseConnectionsGroup(g)
    if (!pg) return null
    out.push(pg)
  }
  return out
}

/** Build full puzzle from POST/PATCH body after validation. */
export function parseConnectionsUpsertBody(body: unknown, existingId?: string): ConnectionsPuzzle {
  if (!body || typeof body !== 'object') throw new Error('Invalid body')
  const p = body as Record<string, unknown>
  const id = typeof p.id === 'string' && p.id.trim() ? p.id : existingId ?? ''
  if (!id.trim()) throw new Error('id required')
  const title = typeof p.title === 'string' ? p.title.trim() : ''
  const description = typeof p.description === 'string' ? p.description : ''
  const slugRaw = typeof p.slug === 'string' ? p.slug.trim() : ''
  const slug = slugRaw || `${slugify(title)}-${id.slice(0, 8)}`
  const tags = Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === 'string') : []
  const authorDisplay = typeof p.authorDisplay === 'string' ? p.authorDisplay.trim() : ''
  const authorFingerprint = typeof p.authorFingerprint === 'string' ? p.authorFingerprint.trim() : ''
  const groups = parseGroupsJsonb(p.groups)
  if (!groups) throw new Error('groups invalid')
  const createdAt = typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString()
  const updatedAt = typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString()
  const puzzle: ConnectionsPuzzle = {
    id,
    version: CONNECTIONS_SCHEMA_VERSION,
    slug,
    title,
    description,
    tags,
    groups,
    authorDisplay: authorDisplay || 'Anonymous',
    authorFingerprint,
    createdAt,
    updatedAt,
  }
  const err = validateConnectionsPuzzleShape(puzzle)
  if (err) throw new Error(err)
  // slug uniqueness enforced by DB; avoid empty slug
  if (!puzzle.slug.trim()) throw new Error('slug required')
  return puzzle
}

export function puzzleToDbRow(puzzle: ConnectionsPuzzle): Omit<ConnectionsDbRow, 'play_count' | 'solve_count' | 'total_mistakes'> {
  return {
    id: puzzle.id,
    slug: puzzle.slug,
    title: puzzle.title,
    description: puzzle.description,
    groups: puzzle.groups,
    tags: puzzle.tags.length ? puzzle.tags : [],
    author_display: puzzle.authorDisplay,
    author_fingerprint: puzzle.authorFingerprint,
    created_at: puzzle.createdAt,
    updated_at: puzzle.updatedAt,
  }
}

export function dbRowToPuzzle(row: ConnectionsDbRow): ConnectionsPuzzle {
  const groups = parseGroupsJsonb(row.groups)
  if (!groups) throw new Error('corrupt row groups')
  return {
    id: row.id,
    version: CONNECTIONS_SCHEMA_VERSION,
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    tags: row.tags ?? [],
    groups,
    authorDisplay: row.author_display ?? '',
    authorFingerprint: row.author_fingerprint ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function dbRowToSummary(row: ConnectionsDbRow): ConnectionsPuzzleSummary {
  const groups = parseGroupsJsonb(row.groups)
  if (!groups) throw new Error('corrupt row groups')
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    tags: row.tags ?? [],
    authorDisplay: row.author_display ?? '',
    groups,
    playCount: row.play_count ?? 0,
    solveCount: row.solve_count ?? 0,
    totalMistakes: row.total_mistakes ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Server-side duplicate word check using same normalization as client. */
export function assertUniqueWords(groups: ConnectionsGroup[]): void {
  const keys = new Set<string>()
  for (const g of groups) {
    for (const w of g.words) {
      const k = wordKey(w)
      if (keys.has(k)) throw new Error('duplicate word')
      keys.add(k)
    }
  }
  if (keys.size !== 16) throw new Error('all 16 words must be unique')
}
