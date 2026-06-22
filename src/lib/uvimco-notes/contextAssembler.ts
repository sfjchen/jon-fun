import { formatGlossaryForPrompt } from './glossary'
import { formatSourcesForPrompt, loadSourcesLocal } from './sources'
import type { NoteSession } from './types'

const MS_PER_DAY = 86_400_000

function recencyWeight(updatedAt: string): number {
  const ageDays = (Date.now() - new Date(updatedAt).getTime()) / MS_PER_DAY
  return Math.exp(-ageDays / 14)
}

export function assembleClientContext(opts: {
  query: string
  activeSession: NoteSession
  allSessions: NoteSession[]
  maxNotes?: number
}): { glossaryBlock: string; sourcesBlock: string; relatedNotesBlock: string } {
  const glossaryBlock = formatGlossaryForPrompt(12)
  const sources = loadSourcesLocal().filter((s) => s.includeInContext)
  const sourcesBlock = formatSourcesForPrompt(sources, opts.query)

  const tagSet = new Set(opts.activeSession.tags.map((t) => t.toLowerCase()))
  const related = opts.allSessions
    .filter((s) => s.id !== opts.activeSession.id)
    .map((s) => {
      let score = recencyWeight(s.updatedAt) * 10
      for (const t of s.tags) {
        if (tagSet.has(t.toLowerCase())) score += 15
      }
      if (s.notes.toLowerCase().includes(opts.query.toLowerCase().slice(0, 20))) score += 8
      for (const lk of s.lookups) {
        if (lk.query.toLowerCase().includes(opts.query.toLowerCase().slice(0, 12))) score += 5
      }
      return { s, score }
    })
    .filter((x) => x.score > 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxNotes ?? 3)

  const relatedNotesBlock = related
    .map(({ s }) => `- ${s.title} (${s.updatedAt.slice(0, 10)}): ${s.notes.slice(0, 200).replace(/\n/g, ' ')}…`)
    .join('\n')

  return {
    glossaryBlock,
    sourcesBlock,
    relatedNotesBlock: relatedNotesBlock || '(none)',
  }
}
