import { formatGlossaryForPrompt } from './glossary'
import {
  formatRankedRelated,
  formatRankedSources,
  rankRelatedSessions,
  rankSourcesForQuery,
} from './contextRag'
import { resolveDomainOpts, resolveDomainsForNote } from './knowledge/registry'
import { formatSectionsOutline, parseNoteSections } from './knowledge/sectioning'
import { formatSourcesForPrompt, loadSourcesLocal } from './sources'
import type { NoteSession } from './types'

const MS_PER_DAY = 86_400_000

function recencyWeight(updatedAt: string): number {
  const ageDays = (Date.now() - new Date(updatedAt).getTime()) / MS_PER_DAY
  return Math.exp(-ageDays / 14)
}

function baseContext(opts: {
  query: string
  activeSession: NoteSession
  allSessions: NoteSession[]
  maxNotes?: number
}) {
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
    sourcesBlock: formatSourcesForPrompt(sources, opts.query, domainTags),
    relatedNotesBlock: relatedNotesBlock || '(none)',
    sectionsOutline,
    domainId: primary.id,
    noteTags: opts.activeSession.tags,
    sources,
    domainTags,
    keywordRelated: related.map((x) => x.s),
  }
}

export function assembleClientContext(opts: {
  query: string
  activeSession: NoteSession
  allSessions: NoteSession[]
  maxNotes?: number
}) {
  const ctx = baseContext(opts)
  return {
    glossaryBlock: ctx.glossaryBlock,
    sourcesBlock: ctx.sourcesBlock,
    relatedNotesBlock: ctx.relatedNotesBlock,
    sectionsOutline: ctx.sectionsOutline,
    domainId: ctx.domainId,
    noteTags: ctx.noteTags,
  }
}

/** Keyword + optional Gemini embedding re-rank for sources and related notes. */
export async function assembleClientContextAsync(opts: {
  query: string
  activeSession: NoteSession
  allSessions: NoteSession[]
  maxNotes?: number
}) {
  const ctx = baseContext(opts)
  const [rankedSources, rankedRelated] = await Promise.all([
    rankSourcesForQuery(ctx.sources, opts.query, ctx.domainTags),
    rankRelatedSessions(opts.allSessions, opts.query, opts.activeSession.id, opts.maxNotes ?? 3),
  ])

  const sourcesBlock =
    formatRankedSources(rankedSources) || ctx.sourcesBlock || '(none yet)'
  const relatedNotesBlock =
    formatRankedRelated(rankedRelated.length ? rankedRelated : ctx.keywordRelated) || '(none)'

  return {
    glossaryBlock: ctx.glossaryBlock,
    sourcesBlock,
    relatedNotesBlock,
    sectionsOutline: ctx.sectionsOutline,
    domainId: ctx.domainId,
    noteTags: ctx.noteTags,
  }
}
