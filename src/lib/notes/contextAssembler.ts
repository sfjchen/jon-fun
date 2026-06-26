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
import { filterSourcesForNote, isSourceEnabledForNote } from './sourceSelection'
import { formatSplitFullNotes, mergeSplitTags } from './splitContext'
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
  companionSession?: NoteSession | null
  maxNotes?: number
}) {
  const companion = opts.companionSession ?? null
  const mergedNotes = formatSplitFullNotes(opts.activeSession, companion)
  const mergedTags = mergeSplitTags(opts.activeSession, companion)

  const domainOpts = resolveDomainOpts({
    tags: mergedTags,
    notes: mergedNotes,
    query: opts.query,
    ...(opts.activeSession.metadata?.kind ? { kind: opts.activeSession.metadata.kind } : {}),
  })

  const { primary } = resolveDomainsForNote(domainOpts)
  const sections = parseNoteSections(mergedNotes)
  const sectionsOutline = formatSectionsOutline(sections)
  const glossaryBlock = formatGlossaryForPrompt(12)
  const allSources = loadSourcesLocal()
  const sources = companion
    ? allSources.filter(
        (s) =>
          isSourceEnabledForNote(opts.activeSession, s.id) ||
          isSourceEnabledForNote(companion, s.id),
      )
    : filterSourcesForNote(allSources, opts.activeSession)
  const domainTags = new Set(primary.tagHints.map((t) => t.toLowerCase()))

  const tagSet = new Set(mergedTags.map((t) => t.toLowerCase()))
  const related = opts.allSessions
    .filter((s) => s.id !== opts.activeSession.id)
    .map((s) => {
      let score = recencyWeight(s.updatedAt) * 10
      for (const t of s.tags) {
        if (tagSet.has(t.toLowerCase())) score += 15
      }
      if (s.metadata?.inferredDomain === primary.id) score += 10
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
    noteTags: mergedTags,
    sources,
    domainTags,
    keywordRelated: related.map((x) => x.s),
  }
}

export function assembleClientContext(opts: {
  query: string
  activeSession: NoteSession
  allSessions: NoteSession[]
  companionSession?: NoteSession | null
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
  companionSession?: NoteSession | null
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
