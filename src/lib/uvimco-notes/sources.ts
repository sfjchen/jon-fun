import type { NoteSource } from './types'

const SOURCES_KEY = 'notes_sources'
const MS_PER_DAY = 86_400_000

export function loadSourcesLocal(): NoteSource[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SOURCES_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as NoteSource[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveSourcesLocal(sources: NoteSource[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources))
}

export function upsertSourceLocal(source: NoteSource): void {
  const list = loadSourcesLocal()
  const idx = list.findIndex((s) => s.id === source.id)
  if (idx >= 0) list[idx] = source
  else list.unshift(source)
  saveSourcesLocal(list)
}

export function deleteSourceLocal(id: string): void {
  saveSourcesLocal(loadSourcesLocal().filter((s) => s.id !== id))
}

export function formatSourcesForPrompt(sources: NoteSource[], query: string): string {
  const needle = query.toLowerCase()
  const ranked = sources
    .map((s) => {
      let score = s.includeInContext ? 5 : 0
      if (s.title.toLowerCase().includes(needle)) score += 10
      if (s.content.toLowerCase().includes(needle)) score += 8
      for (const t of s.tags) {
        if (needle.includes(t.toLowerCase())) score += 4
      }
      const age = Date.now() - new Date(s.updatedAt).getTime()
      score += Math.max(0, 5 - age / (MS_PER_DAY * 30))
      return { s, score }
    })
    .filter((x) => x.score > 0 || x.s.includeInContext)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  return ranked
    .map(({ s }) => `[${s.title}]\n${s.content.slice(0, 1500)}`)
    .join('\n\n')
}

export function genSourceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `src-${Date.now()}`
}
