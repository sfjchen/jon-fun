/**
 * Built-in reference packs — seeded as Sources (localStorage + Supabase sync).
 * User can toggle include-in-context per source in panel.
 */

import { KNOWLEDGE_DOMAINS, type KnowledgeDomainId } from './registry'
import type { NoteSource } from '../types'

const BUILTIN_PREFIX = 'builtin-pack-'

export function builtinSourceId(domainId: KnowledgeDomainId): string {
  return `${BUILTIN_PREFIX}${domainId}`
}

export function isBuiltinSource(id: string): boolean {
  return id.startsWith(BUILTIN_PREFIX)
}

/** Reference packs derived from domain registry — dense, AI-ready. */
export function buildBuiltinSources(): NoteSource[] {
  const now = new Date().toISOString()
  const ids: KnowledgeDomainId[] = ['uvimco-endowment', 'portfolio-quant', 'cfa-l1']

  return ids.map((id) => {
    const d = KNOWLEDGE_DOMAINS[id]
    return {
      id: builtinSourceId(id),
      title: `[Pack] ${d.label}`,
      kind: 'paste' as const,
      content: `# ${d.label}\n\n${d.coreContext}\n\nTag hints: ${d.tagHints.join(', ') || 'none'}`,
      tags: ['builtin', ...d.tagHints.slice(0, 4)],
      includeInContext: id === 'uvimco-endowment' || id === 'portfolio-quant',
      createdAt: now,
      updatedAt: now,
    }
  })
}

/** Merge built-in packs into local sources if missing (never overwrite user edits). */
export function ensureBuiltinSources(existing: NoteSource[]): NoteSource[] {
  const byId = new Map(existing.map((s) => [s.id, s]))
  for (const pack of buildBuiltinSources()) {
    if (!byId.has(pack.id)) byId.set(pack.id, pack)
  }
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
