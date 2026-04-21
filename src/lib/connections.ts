/** Connections-style puzzle types + validation + share helpers (client-safe). */

export const CONNECTIONS_SCHEMA_VERSION = 1 as const
export const CONNECTIONS_WORD_MAX_LEN = 24
export const CONNECTIONS_MAX_BODY_CHARS = 32_000

export const CONNECTIONS_CLIENT_ID_KEY = 'connections:clientId'
export const CONNECTIONS_DRAFT_KEY = 'connections:draft'
export const CONNECTIONS_RECORD_GUARD_PREFIX = 'connections:recorded:'

export type ConnectionsDifficulty = 'yellow' | 'green' | 'blue' | 'purple'

export const CONNECTIONS_DIFFICULTIES: ConnectionsDifficulty[] = ['yellow', 'green', 'blue', 'purple']

export interface ConnectionsGroup {
  category: string
  difficulty: ConnectionsDifficulty
  words: [string, string, string, string]
}

export interface ConnectionsPuzzle {
  id: string
  version: typeof CONNECTIONS_SCHEMA_VERSION
  slug: string
  title: string
  description: string
  tags: string[]
  groups: ConnectionsGroup[]
  authorDisplay: string
  authorFingerprint: string
  createdAt: string
  updatedAt: string
}

export interface ConnectionsPuzzleSummary {
  id: string
  slug: string
  title: string
  description: string
  tags: string[]
  authorDisplay: string
  groups: ConnectionsGroup[]
  playCount: number
  solveCount: number
  totalMistakes: number
  createdAt: string
  updatedAt: string
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'puzzle'
  )
}

export function generateConnectionsId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function getOrCreateConnectionsClientId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const k = CONNECTIONS_CLIENT_ID_KEY
    let id = localStorage.getItem(k)
    if (!id) {
      id = generateConnectionsId()
      localStorage.setItem(k, id)
    }
    return id
  } catch {
    return ''
  }
}

export function normalizeWord(w: string): string {
  return w.trim().replace(/\s+/g, ' ')
}

export function wordKey(w: string): string {
  return normalizeWord(w).toLowerCase()
}

export function isConnectionsDifficulty(v: unknown): v is ConnectionsDifficulty {
  return typeof v === 'string' && (CONNECTIONS_DIFFICULTIES as string[]).includes(v)
}

export function parseConnectionsGroup(v: unknown): ConnectionsGroup | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.category !== 'string') return null
  if (!isConnectionsDifficulty(o.difficulty)) return null
  if (!Array.isArray(o.words) || o.words.length !== 4) return null
  const words = o.words.map((x) => (typeof x === 'string' ? normalizeWord(x) : '')) as [
    string,
    string,
    string,
    string,
  ]
  if (words.some((w) => !w)) return null
  return { category: o.category.trim(), difficulty: o.difficulty, words }
}

/** Validate puzzle shape; returns error message or null if ok. */
export function validateConnectionsPuzzleShape(p: Partial<ConnectionsPuzzle>): string | null {
  if (!p.title?.trim()) return 'title required'
  if (!Array.isArray(p.groups) || p.groups.length !== 4) return 'exactly 4 groups required'
  const groups: ConnectionsGroup[] = []
  for (const g of p.groups) {
    const pg = parseConnectionsGroup(g)
    if (!pg) return 'invalid group'
    for (const w of pg.words) {
      if (w.length > CONNECTIONS_WORD_MAX_LEN) return `word too long (max ${CONNECTIONS_WORD_MAX_LEN})`
    }
    if (!pg.category.trim()) return 'category required'
    groups.push(pg)
  }
  const tiers = groups.map((g) => g.difficulty)
  const tierSet = new Set(tiers)
  if (tierSet.size !== 4) return 'each difficulty (yellow/green/blue/purple) must appear exactly once'
  const keys = new Set<string>()
  for (const g of groups) {
    for (const w of g.words) {
      const k = wordKey(w)
      if (keys.has(k)) return 'all 16 words must be unique'
      keys.add(k)
    }
  }
  if (keys.size !== 16) return 'all 16 words must be unique'
  return null
}

export function createDefaultConnectionsPuzzle(authorDisplay = 'Anonymous'): ConnectionsPuzzle {
  const title = 'Untitled puzzle'
  const id = generateConnectionsId()
  const now = new Date().toISOString()
  const groups: ConnectionsGroup[] = CONNECTIONS_DIFFICULTIES.map((difficulty, i) => ({
    category: `Category ${i + 1}`,
    difficulty,
    words: ['', '', '', ''] as [string, string, string, string],
  }))
  return {
    id,
    version: CONNECTIONS_SCHEMA_VERSION,
    slug: `${slugify(title)}-${id.slice(0, 8)}`,
    title,
    description: '',
    tags: [],
    groups,
    authorDisplay,
    authorFingerprint: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function puzzleToExportJson(p: ConnectionsPuzzle): string {
  return JSON.stringify(p, null, 2)
}

export function readPuzzleFromJsonText(text: string): ConnectionsPuzzle {
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON')
  const o = parsed as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id : generateConnectionsId()
  const title = typeof o.title === 'string' ? o.title : 'Untitled'
  const slug =
    typeof o.slug === 'string' && o.slug.trim() ? o.slug : `${slugify(title)}-${id.slice(0, 8)}`
  const groupsRaw = Array.isArray(o.groups) ? o.groups : []
  const groups = groupsRaw.map((g) => parseConnectionsGroup(g)).filter(Boolean) as ConnectionsGroup[]
  const puzzle: ConnectionsPuzzle = {
    id,
    version: CONNECTIONS_SCHEMA_VERSION,
    slug,
    title,
    description: typeof o.description === 'string' ? o.description : '',
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
    groups:
      groups.length === 4
        ? groups
        : (createDefaultConnectionsPuzzle().groups as ConnectionsGroup[]),
    authorDisplay: typeof o.authorDisplay === 'string' ? o.authorDisplay : 'Anonymous',
    authorFingerprint: typeof o.authorFingerprint === 'string' ? o.authorFingerprint : '',
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
  }
  const err = validateConnectionsPuzzleShape(puzzle)
  if (err) throw new Error(err)
  return puzzle
}

export function downloadConnectionsPuzzle(p: ConnectionsPuzzle) {
  const data = puzzleToExportJson(p)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(p.title)}.connections.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function readPuzzleFromFile(file: File): Promise<ConnectionsPuzzle> {
  const text = await file.text()
  return readPuzzleFromJsonText(text)
}

const TIER_EMOJI: Record<ConnectionsDifficulty, string> = {
  yellow: '🟨',
  green: '🟩',
  blue: '🟦',
  purple: '🟪',
}

/** One row per group in Y→G→B→P order: four emojis if that group was solved by player, else four ⬜. */
export function buildShareLines(
  solvedDifficulties: Set<ConnectionsDifficulty>,
  won: boolean,
): string[] {
  const lines: string[] = []
  for (const d of CONNECTIONS_DIFFICULTIES) {
    const e = solvedDifficulties.has(d) ? TIER_EMOJI[d] : '⬜'
    lines.push(`${e}${e}${e}${e}`)
  }
  if (!won) lines.push('💔')
  return lines
}

/** Check if selected 4 words match exactly one group (by normalized word set). */
export function findMatchingGroup(
  groups: ConnectionsGroup[],
  selectedWords: string[],
): ConnectionsGroup | null {
  if (selectedWords.length !== 4) return null
  const sel = new Set(selectedWords.map(wordKey))
  if (sel.size !== 4) return null
  for (const g of groups) {
    const gset = new Set(g.words.map(wordKey))
    if (sel.size === gset.size && [...sel].every((k) => gset.has(k))) return g
  }
  return null
}

/** True if selection is wrong but overlaps 3 words with some real group. */
export function isOneAway(groups: ConnectionsGroup[], selectedWords: string[]): boolean {
  if (selectedWords.length !== 4) return false
  const sel = selectedWords.map(wordKey)
  if (new Set(sel).size !== 4) return false
  for (const g of groups) {
    const gkeys = g.words.map(wordKey)
    let overlap = 0
    for (const s of sel) {
      if (gkeys.includes(s)) overlap++
    }
    if (overlap === 3) return true
  }
  return false
}

export function sortGroupsByDifficulty(groups: ConnectionsGroup[]): ConnectionsGroup[] {
  const order: ConnectionsDifficulty[] = ['yellow', 'green', 'blue', 'purple']
  return [...groups].sort((a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty))
}

export function summarySolveRate(solveCount: number, playCount: number): number {
  if (playCount <= 0) return 0
  return Math.round((100 * solveCount) / playCount)
}

export function summaryAvgMistakes(totalMistakes: number, playCount: number): number {
  if (playCount <= 0) return 0
  return Math.round((10 * totalMistakes) / playCount) / 10
}

export type EditorCheckItem = { id: string; label: string; pass: boolean }

/** Granular checklist for the editor (draft-safe; empty words fail word-related items). */
export function editorChecklist(p: ConnectionsPuzzle): { pass: boolean; items: EditorCheckItem[] } {
  const items: EditorCheckItem[] = []
  items.push({ id: 'title', label: 'Title filled', pass: Boolean(p.title?.trim()) })
  const tierOk =
    p.groups.length === 4 &&
    CONNECTIONS_DIFFICULTIES.every((d) => p.groups.filter((g) => g.difficulty === d).length === 1)
  items.push({
    id: 'tiers',
    label: 'Yellow / Green / Blue / Purple each used once',
    pass: tierOk,
  })
  items.push({
    id: 'cats',
    label: 'All category labels filled',
    pass: p.groups.every((g) => g.category.trim().length > 0),
  })
  const words = p.groups.flatMap((g) => g.words)
  const nonEmpty = words.every((w) => normalizeWord(w).length > 0)
  items.push({ id: 'words_nonempty', label: 'All 16 word slots filled', pass: nonEmpty })
  const lenOk = words.every((w) => normalizeWord(w).length <= CONNECTIONS_WORD_MAX_LEN)
  items.push({
    id: 'word_len',
    label: `Each word ≤ ${CONNECTIONS_WORD_MAX_LEN} chars`,
    pass: lenOk,
  })
  const keys = words.map(wordKey)
  const uniq = new Set(keys)
  items.push({
    id: 'uniq',
    label: 'All 16 words unique (case-insensitive)',
    pass: nonEmpty && uniq.size === 16,
  })
  const shapeErr = validateConnectionsPuzzleShape(p)
  items.push({ id: 'valid', label: 'Passes full validation', pass: shapeErr === null })
  return { pass: items.every((i) => i.pass), items }
}
