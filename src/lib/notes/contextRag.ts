/**
 * Client-side semantic re-ranking for Notes lookup context (sources + related notes).
 * Falls back to keyword ranking when embed API unavailable.
 */

import type { NoteSession, NoteSource } from './types'
import { notesSyncCredentials } from './syncCredentials'
import { formatSectionsOutline, parseNoteSections } from './knowledge/sectioning'

type Ranked<T> = { item: T; score: number }

async function fetchEmbedScores(query: string, excerpts: string[]): Promise<number[] | null> {
  if (!excerpts.length) return []
  try {
    const creds = notesSyncCredentials()
    const res = await fetch('/api/notes/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, excerpts, ...creds }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { scores?: number[] }
    return Array.isArray(data.scores) && data.scores.length === excerpts.length ? data.scores : null
  } catch {
    return null
  }
}

function keywordSourceScore(s: NoteSource, query: string, domainTags?: Set<string>): number {
  const needle = query.toLowerCase()
  let score = 5
  if (s.title.toLowerCase().includes(needle)) score += 10
  if (s.content.toLowerCase().includes(needle)) score += 8
  for (const t of s.tags) {
    if (needle.includes(t.toLowerCase())) score += 4
    if (domainTags?.has(t.toLowerCase())) score += 6
  }
  return score
}

export async function rankSourcesForQuery(
  sources: NoteSource[],
  query: string,
  domainTagHints?: Set<string>,
  limit = 4,
): Promise<NoteSource[]> {
  const candidates = sources
  if (!candidates.length) return []

  const excerpts = candidates.map((s) => `${s.title}\n${s.content.slice(0, 1500)}`)
  const embedScores = await fetchEmbedScores(query, excerpts)

  const ranked: Ranked<NoteSource>[] = candidates.map((s, i) => {
    let score = keywordSourceScore(s, query, domainTagHints)
    if (embedScores) score += embedScores[i]! * 25
    return { item: s, score }
  })

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item)
}

export async function rankRelatedSessions(
  sessions: NoteSession[],
  query: string,
  activeId: string,
  limit = 3,
): Promise<NoteSession[]> {
  const candidates = sessions.filter((s) => s.id !== activeId && s.notes.trim().length > 20)
  if (!candidates.length) return []

  const excerpts = candidates.map((s) => {
    const outline = formatSectionsOutline(parseNoteSections(s.notes), 4)
    return `${s.title}\n${outline}\n${s.notes.slice(0, 800)}`
  })
  const embedScores = await fetchEmbedScores(query, excerpts)

  const ranked: Ranked<NoteSession>[] = candidates.map((s, i) => {
    let score = 0
    if (embedScores) score += embedScores[i]! * 30
    if (s.notes.toLowerCase().includes(query.toLowerCase().slice(0, 16))) score += 10
    return { item: s, score }
  })

  return ranked
    .filter((x) => x.score > 0.15 || x.item.notes.toLowerCase().includes(query.toLowerCase().slice(0, 8)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item)
}

export function formatRankedSources(sources: NoteSource[]): string {
  return sources.map((s) => `[${s.title}]\n${s.content.slice(0, 1500)}`).join('\n\n')
}

export function formatRankedRelated(sessions: NoteSession[]): string {
  return sessions
    .map((s) => {
      const outline = formatSectionsOutline(parseNoteSections(s.notes), 3)
      return `- ${s.title} (${s.updatedAt.slice(0, 10)}): ${outline}`
    })
    .join('\n')
}
