import type { GlossaryEntry, Lookup } from './types'

const GLOSSARY_KEY = 'notes_glossary'

export function loadGlossary(): GlossaryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(GLOSSARY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as GlossaryEntry[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveGlossary(entries: GlossaryEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(GLOSSARY_KEY, JSON.stringify(entries))
}

function termFromLookup(lookup: Lookup): string {
  const q = lookup.query.trim()
  const acr = q.match(/\b([A-Z]{2,}(?:-[A-Z]+)?)\b/)
  if (acr) return acr[1]!
  const words = q.split(/\s+/).filter(Boolean)
  return words.slice(0, 3).join(' ').slice(0, 48) || q.slice(0, 48)
}

export function upsertFromLookup(lookup: Lookup, noteId: string): GlossaryEntry | null {
  const ans = lookup.conversation.find((m) => m.role === 'assistant')?.content?.trim()
  if (!ans) return null
  const term = termFromLookup(lookup)
  if (!term || term.length < 2) return null

  const entries = loadGlossary()
  const idx = entries.findIndex((e) => e.term.toLowerCase() === term.toLowerCase())
  const entry: GlossaryEntry = {
    term,
    definition: ans.slice(0, 600),
    sourceNoteId: noteId,
    sourceLookupId: lookup.id,
    updatedAt: new Date().toISOString(),
    useCount: (idx >= 0 ? entries[idx]!.useCount : 0) + 1,
  }
  if (idx >= 0) entries[idx] = entry
  else entries.unshift(entry)
  saveGlossary(entries.slice(0, 500))
  return entry
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
  const byTerm = new Map<string, GlossaryEntry>()
  for (const e of [...local, ...remote]) {
    const existing = byTerm.get(e.term.toLowerCase())
    if (!existing || e.updatedAt > existing.updatedAt) byTerm.set(e.term.toLowerCase(), e)
  }
  saveGlossary([...byTerm.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
}
