import {
  DEFAULT_ACTIVE_DOMAIN_ID,
  resolveDomainOpts,
  resolveDomainsForNote,
  type KnowledgeDomainId,
} from './registry'
import { formatSectionsOutline, parseNoteSections } from './sectioning'
import { AGENT_ACTIONS_FOOTER } from '../agentActions'

export type { KnowledgeDomainId } from './registry'
export { DEFAULT_ACTIVE_DOMAIN_ID, FALLBACK_DOMAIN_ID, KNOWLEDGE_DOMAINS, getDomain, listDomains, resolveDomainsForNote } from './registry'
export { parseNoteSections, sectionAtLine, formatSectionsOutline, suggestTagsFromSections } from './sectioning'
export { ensureBuiltinSources, buildBuiltinSources, isBuiltinSource } from './builtinSources'

const BASE_RULES = `Rules:
- No markdown headers (#), no asterisk bullets, no "Great question!"
- Skimmable: short blocks separated by blank lines
- Plain English; explain jargon inline
- Do NOT label blocks Intent, Follow up, or a separate "angle" section — one integrated answer only
- If screenshot attached, reference it naturally`

/** Line ? lookup — term + concise definition (no section labels). */
function responseFormatLine(): string {
  return `Plain text only (no markdown # headers, no labels like "Core meaning" or "Typical ranges"):

Line 1: the term or phrase in canonical form (e.g. TVPI)
Line 2: blank
Line 3+: 1-3 concise sentences — plain-English definition with active-domain context when helpful. Answer directly.

For metrics/ratios only: after the definition, one blank line, then 2-3 short lines on typical magnitudes (e.g. "Early fund ~0.2–0.4; mature ~1.0+") — still no section label. Omit for non-numeric concepts.`
}

/** Section ?? lookup — same shape, slightly more room. */
function sectionResponseFormat(): string {
  return `Plain text only (no markdown # headers, no labels like "Core meaning" or "Typical ranges"):

Line 1: the main topic or term for this section block
Line 2: blank
Line 3+: 2-4 concise sentences on what this section is about — domain context woven in; infer the likely question.

For metrics in the section: optional blank line + 2-4 short typical-magnitude lines (no label). Omit if not applicable.`
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

RUNNING DICTIONARY:
${opts.glossary?.trim() || '(none yet)'}

RELATED NOTES:
${opts.relatedNotes?.trim() || '(none)'}

RESPONSE FORMAT — follow exactly:
${responseFormatLine()}

${BASE_RULES}
- Max ~90 words for line mode (optional magnitude lines can add ~40 words when needed)`
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
${sectionResponseFormat()}

${BASE_RULES}
- Under ~140 words unless section is complex or magnitude lines apply`
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

/** Agent chat — Cursor-like assistant with mutation access to note + dictionary. */
export function buildAgentSystemPrompt(opts: {
  domainId?: KnowledgeDomainId
  tags?: string[]
  notes?: string
  title?: string
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

  return `You are an embedded AI assistant inside a personal Notes app (like Cursor chat for this vault). The user can ask about concepts, features, their notes, or request edits.

ACTIVE DOMAIN: ${primary.label}
${primary.coreContext}

CURRENT NOTE:
Title: ${opts.title?.trim() || 'Untitled'}
Tags: ${opts.tags?.length ? opts.tags.join(', ') : '(none)'}

NOTE STRUCTURE:
${opts.sectionsOutline ?? '(not provided)'}

FULL NOTE BODY:
${opts.notes?.trim() || '(empty)'}

REFERENCE DOCS:
${opts.sources?.trim() || '(none yet)'}

DICTIONARY (editable term → definition):
${opts.glossary?.trim() || '(none yet)'}

RELATED NOTES:
${opts.relatedNotes?.trim() || '(none)'}

Behavior:
- Answer naturally in plain text — explain, plan, or execute changes when asked.
- For finance/metric questions: term on its own line, blank line, concise definition — no section labels.
- dictionary.set definitions must be plain concise text only (term is separate); never include "Core meaning" or similar labels.
- When the user asks to store a definition, fix note text, rename the note, or change tags — use the ACTIONS block below.
- Confirm what you changed in your visible reply.
- You can discuss app features and suggest workflows; you have full read access to the note above.

${AGENT_ACTIONS_FOOTER}`
}

/** Legacy exports — resolve prompts dynamically from note context. */
export function resolveSystemPrompt(
  mode: 'lookup' | 'followup' | 'decode' | 'agent',
  triggerType: 'line' | 'section',
  ctx: {
    domainId?: KnowledgeDomainId
    tags?: string[]
    notes?: string
    title?: string
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
    ...(ctx.title ? { title: ctx.title } : {}),
    ...(ctx.query ? { query: ctx.query } : {}),
    ...(ctx.sourcesBlock ? { sources: ctx.sourcesBlock } : {}),
    ...(ctx.glossaryBlock ? { glossary: ctx.glossaryBlock } : {}),
    ...(ctx.relatedNotesBlock ? { relatedNotes: ctx.relatedNotesBlock } : {}),
    ...(sectionsOutline ? { sectionsOutline } : {}),
  }

  if (mode === 'agent') return buildAgentSystemPrompt(base)
  if (mode === 'decode') return buildSummarizeSystemPrompt(base)
  if (mode === 'followup') return buildAgentSystemPrompt(base)
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
