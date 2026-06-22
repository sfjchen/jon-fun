/**
 * Sync glossary + sources between localStorage and Supabase (service-role API).
 */

import { loadGlossary, mergeGlossaryFromServer } from './glossary'
import { getEffectiveUserId } from './storage'
import { loadSourcesLocal, saveSourcesLocal } from './sources'
import type { GlossaryEntry, NoteSource } from './types'

export async function fetchGlossaryFromServer(): Promise<GlossaryEntry[]> {
  const userId = getEffectiveUserId()
  const res = await fetch(`/api/uvimco-notes/glossary?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return []
  const data = (await res.json()) as { entries?: GlossaryEntry[] }
  return Array.isArray(data.entries) ? data.entries : []
}

export async function pushGlossaryToServer(entries?: GlossaryEntry[]): Promise<boolean> {
  const userId = getEffectiveUserId()
  const list = entries ?? loadGlossary()
  if (!list.length) return true
  const res = await fetch('/api/uvimco-notes/glossary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, entries: list }),
  })
  return res.ok
}

export async function fetchSourcesFromServer(): Promise<NoteSource[]> {
  const userId = getEffectiveUserId()
  const res = await fetch(`/api/uvimco-notes/sources?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return []
  const data = (await res.json()) as { sources?: NoteSource[] }
  return Array.isArray(data.sources) ? data.sources : []
}

export async function pushSourcesToServer(sources?: NoteSource[]): Promise<boolean> {
  const userId = getEffectiveUserId()
  const list = sources ?? loadSourcesLocal()
  if (!list.length) return true
  const res = await fetch('/api/uvimco-notes/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, sources: list }),
  })
  return res.ok
}

export async function deleteSourceOnServer(sourceId: string): Promise<boolean> {
  const res = await fetch('/api/uvimco-notes/sources', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: getEffectiveUserId(), sourceId }),
  })
  return res.ok
}

/** Merge remote glossary/sources into localStorage after session sync. */
export async function syncMemoryBank(): Promise<{ glossaryOk: boolean; sourcesOk: boolean }> {
  const [remoteGlossary, remoteSources] = await Promise.all([
    fetchGlossaryFromServer(),
    fetchSourcesFromServer(),
  ])

  if (remoteGlossary.length) mergeGlossaryFromServer(remoteGlossary)

  const localSources = loadSourcesLocal()
  const byId = new Map<string, NoteSource>()
  for (const s of [...localSources, ...remoteSources]) {
    const existing = byId.get(s.id)
    if (!existing || s.updatedAt > existing.updatedAt) byId.set(s.id, s)
  }
  saveSourcesLocal([...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))

  const glossaryOk = await pushGlossaryToServer(loadGlossary())
  const sourcesOk = await pushSourcesToServer(loadSourcesLocal())
  return { glossaryOk, sourcesOk }
}
