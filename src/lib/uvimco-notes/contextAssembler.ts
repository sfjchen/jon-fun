import { formatGlossaryForPrompt } from './glossary'
import { resolveDomainOpts, resolveDomainsForNote } from './knowledge/registry'
import { formatSectionsOutline, parseNoteSections } from './knowledge/sectioning'
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
}): {
  glossaryBlock: string
  sourcesBlock: string
  relatedNotesBlock: string
  sectionsOutline: string
  domainId: ReturnType<typeof resolveDomainsForNote>['primary']['id']
  noteTags: string[]
} {
  const domainOpts = resolveDomainOpts({
    tags: opts.activeSession.tags,
    notes: opts.activeSession.notes,
    query: opts.query,
    ...(opts.activeSession.metadata?.domain
      ? { explicitDomain: opts.activeSession.metadata.domain }
      : {}),
    ...(opts.activeSession.metadata?.kind ? { kind: opts.activeSession.metadata.kind } : {}),
  })

  const { primary } = resolveDomainsForNote(domainOpts)

  const sections = parseNoteSections(opts.activeSession.notes)
  const sectionsOutline = formatSectionsOutline(sections)

  const glossaryBlock = formatGlossaryForPrompt(12)
  const sources = loadSourcesLocal().filter((s) => s.includeInContext)
  const domainTags = new Set(primary.tagHints.map((t) => t.toLowerCase()))
  const sourcesBlock = formatSourcesForPrompt(sources, opts.query, domainTags)

  const tagSet = new Set(opts.activeSession.tags.map((t) => t.toLowerCase()))
  const related = opts.allSessions
    .filter((s) => s.id !== opts.activeSession.id)
    .map((s) => {
      let score = recencyWeight(s.updatedAt) * 10
      for (const t of s.tags) {
        if (tagSet.has(t.toLowerCase())) score += 15
      }
      if (s.metadata?.domain === primary.id) score += 10
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
    .map(({ s }) => {
      const outline = formatSectionsOutline(parseNoteSections(s.notes), 3)
      return `- ${s.title} (${s.updatedAt.slice(0, 10)}): ${outline}`
    })
    .join('\n')

  return {
    glossaryBlock,
    sourcesBlock,
    relatedNotesBlock: relatedNotesBlock || '(none)',
    sectionsOutline,
    domainId: primary.id,
    noteTags: opts.activeSession.tags,
  }
}
