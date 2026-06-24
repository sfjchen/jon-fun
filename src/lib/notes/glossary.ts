import type { GlossaryEntry, Lookup } from './types'

const GLOSSARY_KEY = 'notes_glossary'

const SKIP_TERM_RE = /^(stored\s+test|test(\s|$)|e2e(\s|$)|mock)/i

const DEFINITION_LABEL_RE = /^(core meaning|typical ranges)\s*:?\s*$/i

/** Strip section labels and return concise definition text for dictionary storage. */
export function extractDefinitionFromAssistant(content: string, term?: string): string {
  const lines = content.trim().split('\n')
  const kept: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('')
      continue
    }
    if (DEFINITION_LABEL_RE.test(line)) continue
    kept.push(line)
  }

  let text = kept.join('\n').trim()
  if (!text) return content.trim().slice(0, 600)

  const blocks = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
  if (!blocks.length) return text.slice(0, 600)

  let startIdx = 0
  if (term && blocks[0]) {
    const first = blocks[0]!
    const termLower = term.toLowerCase()
    if (
      first.toLowerCase() === termLower ||
      (first.length <= term.length + 8 && first.toLowerCase().includes(termLower))
    ) {
      startIdx = 1
    }
  }

  const defBlock = blocks[startIdx] ?? blocks[0]!
  return defBlock.replace(/\n{2,}/g, '\n').trim().slice(0, 600)
}

function isSkippedTerm(term: string): boolean {
  const t = term.trim()
  if (t.length < 2) return true
  return SKIP_TERM_RE.test(t)
}

/** Split "mv vs dan" into ["mv", "dan"]; pass through normal terms. */
function expandTermLabel(term: string): string[] {
  const t = term.trim()
  const vs = t.match(/^(.+?)\s+vs\.?\s+(.+)$/i)
  if (vs) {
    return [vs[1]!.trim(), vs[2]!.trim()].filter((p) => p.length >= 2 && !isSkippedTerm(p))
  }
  if (isSkippedTerm(t)) return []
  return [t]
}

function sanitizeEntries(entries: GlossaryEntry[]): GlossaryEntry[] {
  const byTerm = new Map<string, GlossaryEntry>()
  for (const e of entries) {
    for (const label of expandTermLabel(e.term)) {
      const key = label.toLowerCase()
      const next: GlossaryEntry = { ...e, term: label }
      const existing = byTerm.get(key)
      if (!existing || next.updatedAt > existing.updatedAt) byTerm.set(key, next)
    }
  }
  return [...byTerm.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadGlossary(): GlossaryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(GLOSSARY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as GlossaryEntry[]
    if (!Array.isArray(arr)) return []
    const clean = sanitizeEntries(arr)
    if (JSON.stringify(clean) !== JSON.stringify(arr)) saveGlossary(clean)
    return clean
  } catch {
    return []
  }
}

export function saveGlossary(entries: GlossaryEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(GLOSSARY_KEY, JSON.stringify(sanitizeEntries(entries)))
}

/** Manual dictionary edit (user or AI agent). */
export function upsertManualEntry(
  term: string,
  definition: string,
  noteId: string,
  lookupId = 'manual',
): GlossaryEntry {
  const label = term.trim()
  const def = extractDefinitionFromAssistant(definition, label).slice(0, 600)
  const entries = loadGlossary()
  const idx = entries.findIndex((e) => e.term.toLowerCase() === label.toLowerCase())
  const entry: GlossaryEntry = {
    term: label,
    definition: def,
    sourceNoteId: noteId,
    sourceLookupId: lookupId,
    updatedAt: new Date().toISOString(),
    useCount: (idx >= 0 ? entries[idx]!.useCount : 0) + 1,
  }
  if (idx >= 0) entries[idx] = entry
  else entries.unshift(entry)
  saveGlossary(entries.slice(0, 500))
  return entry
}

export function deleteDictionaryEntry(term: string): boolean {
  const label = term.trim()
  if (!label) return false
  const entries = loadGlossary()
  const next = entries.filter((e) => e.term.toLowerCase() !== label.toLowerCase())
  if (next.length === entries.length) return false
  saveGlossary(next)
  return true
}

function primaryTermFromQuery(q: string): string {
  const acr = q.match(/\b([A-Z]{2,}(?:-[A-Z]+)?)\b/)
  if (acr) return acr[1]!
  const words = q.split(/\s+/).filter(Boolean)
  return words.slice(0, 3).join(' ').slice(0, 48) || q.slice(0, 48)
}

/** Terms to store from a lookup query (splits "X vs Y", skips test noise). */
export function termsFromLookup(lookup: Lookup): string[] {
  const q = lookup.query.trim()
  if (!q) return []
  const expanded = expandTermLabel(q)
  if (expanded.length > 1) return expanded
  const single = primaryTermFromQuery(q)
  return expandTermLabel(single)
}

export function upsertFromLookup(lookup: Lookup, noteId: string): GlossaryEntry | null {
  const ans = lookup.conversation.find((m) => m.role === 'assistant')?.content?.trim()
  if (!ans) return null
  const terms = termsFromLookup(lookup)
  if (!terms.length) return null

  const entries = loadGlossary()
  let last: GlossaryEntry | null = null
  for (const term of terms) {
    const idx = entries.findIndex((e) => e.term.toLowerCase() === term.toLowerCase())
    const definition = extractDefinitionFromAssistant(ans, term)
    const entry: GlossaryEntry = {
      term,
      definition,
      sourceNoteId: noteId,
      sourceLookupId: lookup.id,
      updatedAt: new Date().toISOString(),
      useCount: (idx >= 0 ? entries[idx]!.useCount : 0) + 1,
    }
    if (idx >= 0) entries[idx] = entry
    else entries.unshift(entry)
    last = entry
  }
  saveGlossary(entries.slice(0, 500))
  return last
}

export function formatGlossaryForPrompt(maxEntries = 12): string {
  return loadGlossary()
    .slice(0, maxEntries)
    .map((e) => `${e.term}: ${e.definition.slice(0, 120)}`)
    .join('\n')
}

export function searchGlossary(q: string): GlossaryEntry[] {
  const needle = q.toLowerCase().trim()
  if (!needle) return loadGlossary().slice(0, 20)
  return loadGlossary().filter(
    (e) => e.term.toLowerCase().includes(needle) || e.definition.toLowerCase().includes(needle),
  )
}

export function mergeGlossaryFromServer(remote: GlossaryEntry[]): void {
  const local = loadGlossary()
  saveGlossary(sanitizeEntries([...local, ...remote]))
}
