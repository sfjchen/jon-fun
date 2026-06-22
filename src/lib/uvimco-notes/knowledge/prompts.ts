import {
  DEFAULT_ACTIVE_DOMAIN_ID,
  resolveDomainOpts,
  resolveDomainsForNote,
  type KnowledgeDomainId,
} from './registry'
import { formatSectionsOutline, parseNoteSections } from './sectioning'

export type { KnowledgeDomainId } from './registry'
export { DEFAULT_ACTIVE_DOMAIN_ID, FALLBACK_DOMAIN_ID, KNOWLEDGE_DOMAINS, getDomain, listDomains, resolveDomainsForNote } from './registry'
export { parseNoteSections, sectionAtLine, formatSectionsOutline, suggestTagsFromSections } from './sectioning'
export { ensureBuiltinSources, buildBuiltinSources, isBuiltinSource } from './builtinSources'

const BASE_RULES = `Rules:
- No markdown headers (#), no bullet asterisks, no "Great question!"
- Skimmable: short blocks separated by blank lines
- Plain English; explain jargon inline
- If screenshot attached, reference it naturally`

function responseFormatLine(angleLabel: string): string {
  return `- Line 1: Intent — one short phrase guessing what the user wants
- Blank line
- Meaning — 1-2 dense partial sentences
- Blank line
- ${angleLabel} — 1 sentence if relevant
- Blank line
- Follow up if — optional half-sentence when ambiguity remains`
}

function sectionResponseFormat(angleLabel: string): string {
  return `- Intent — what you think they're asking (one line)
- Blank line
- Core answer — 2-4 dense partial sentences across the section theme
- Blank line
- ${angleLabel} — one sentence
- Blank line
- Related — optional adjacent topics or follow-up prompt`
}

export function buildLineSystemPrompt(opts: {
  domainId?: KnowledgeDomainId
  tags?: string[]
  notes?: string
  query?: string
  sources?: string
  glossary?: string
  relatedNotes?: string
  sectionsOutline?: string
}): string {
  const { primary } = resolveDomainsForNote(
    resolveDomainOpts({
      ...(opts.domainId ? { explicitDomain: opts.domainId } : {}),
      ...(opts.tags?.length ? { tags: opts.tags } : {}),
      ...(opts.notes ? { notes: opts.notes } : {}),
      ...(opts.query ? { query: opts.query } : {}),
    }),
  )
  const domain = primary

  return `You are a concise learning assistant for a long-term personal notes vault (finance, portfolio management, professional development).

ACTIVE DOMAIN: ${domain.label}
${domain.coreContext}

NOTE STRUCTURE (auto-sectioned):
${opts.sectionsOutline ?? '(not provided)'}

REFERENCE DOCS (user sources + packs):
${opts.sources?.trim() || '(none yet)'}

RUNNING GLOSSARY:
${opts.glossary?.trim() || '(none yet)'}

RELATED NOTES:
${opts.relatedNotes?.trim() || '(none)'}

RESPONSE FORMAT — follow exactly:
${responseFormatLine(domain.angleLabel)}

${BASE_RULES}
- Max ~4 short blocks for line mode`
}

export function buildSectionSystemPrompt(opts: {
  domainId?: KnowledgeDomainId
  tags?: string[]
  notes?: string
  query?: string
  sources?: string
  glossary?: string
  relatedNotes?: string
  sectionsOutline?: string
}): string {
  const { primary } = resolveDomainsForNote(
    resolveDomainOpts({
      ...(opts.domainId ? { explicitDomain: opts.domainId } : {}),
      ...(opts.tags?.length ? { tags: opts.tags } : {}),
      ...(opts.notes ? { notes: opts.notes } : {}),
      ...(opts.query ? { query: opts.query } : {}),
    }),
  )

  return `You are a concise learning assistant. The user marked a SECTION (multiple lines) with ?? at the end. Infer the question they likely have about this block — not just the last line.

ACTIVE DOMAIN: ${primary.label}
${primary.coreContext}

NOTE STRUCTURE:
${opts.sectionsOutline ?? '(not provided)'}

REFERENCE DOCS:
${opts.sources?.trim() || '(none yet)'}

GLOSSARY:
${opts.glossary?.trim() || '(none yet)'}

RELATED NOTES:
${opts.relatedNotes?.trim() || '(none)'}

RESPONSE FORMAT:
${sectionResponseFormat(primary.angleLabel)}

No markdown # headers or * bullets. Blank lines between blocks. Under 120 words unless section is complex.`
}

export function buildSummarizeSystemPrompt(opts: {
  domainId?: KnowledgeDomainId
  tags?: string[]
  notes?: string
  sources?: string
  glossary?: string
  sectionsOutline?: string
}): string {
  const { primary } = resolveDomainsForNote(
    resolveDomainOpts({
      ...(opts.domainId ? { explicitDomain: opts.domainId } : {}),
      ...(opts.tags?.length ? { tags: opts.tags } : {}),
      ...(opts.notes ? { notes: opts.notes } : {}),
    }),
  )

  return `Summarize this note session (${primary.label} context when relevant).

Use plain labels (not markdown #):

Key takeaways
(3-5 short lines)

Terms
(from body + AI lookups if any)

Action items
(lines starting with >)

Open questions
(?? or ? lines)

Section map
${opts.sectionsOutline ?? '(none)'}

Under 400 words. Direct, professional.`
}

/** Legacy exports — resolve prompts dynamically from note context. */
export function resolveSystemPrompt(
  mode: 'lookup' | 'followup' | 'decode',
  triggerType: 'line' | 'section',
  ctx: {
    domainId?: KnowledgeDomainId
    tags?: string[]
    notes?: string
    query?: string
    sourcesBlock?: string
    glossaryBlock?: string
    relatedNotesBlock?: string
  },
): string {
  const sectionsOutline = ctx.notes ? formatSectionsOutline(parseNoteSections(ctx.notes)) : undefined
  const base = {
    ...(ctx.domainId ? { domainId: ctx.domainId } : {}),
    ...(ctx.tags?.length ? { tags: ctx.tags } : {}),
    ...(ctx.notes ? { notes: ctx.notes } : {}),
    ...(ctx.query ? { query: ctx.query } : {}),
    ...(ctx.sourcesBlock ? { sources: ctx.sourcesBlock } : {}),
    ...(ctx.glossaryBlock ? { glossary: ctx.glossaryBlock } : {}),
    ...(ctx.relatedNotesBlock ? { relatedNotes: ctx.relatedNotesBlock } : {}),
    ...(sectionsOutline ? { sectionsOutline } : {}),
  }

  if (mode === 'decode') return buildSummarizeSystemPrompt(base)
  if (triggerType === 'section') return buildSectionSystemPrompt(base)
  return buildLineSystemPrompt(base)
}

/** @deprecated use resolveSystemPrompt — kept for imports */
export const UVIMCO_SYSTEM = buildLineSystemPrompt({ domainId: DEFAULT_ACTIVE_DOMAIN_ID })
export const SECTION_SYSTEM = buildSectionSystemPrompt({ domainId: DEFAULT_ACTIVE_DOMAIN_ID })
export const DECODE_ALL_SYSTEM = buildSummarizeSystemPrompt({ domainId: DEFAULT_ACTIVE_DOMAIN_ID })

export function injectContextPlaceholders(
  system: string,
  sources: string,
  glossary: string,
): string {
  return system
    .replace('{sources}', sources.trim() || '(none yet)')
    .replace('{glossary}', glossary.trim() || '(none yet)')
}
