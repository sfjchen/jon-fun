import type { NoteMetadata, NoteSession, NoteSource } from './types'

export function isSourceEnabledForNote(session: NoteSession, sourceId: string): boolean {
  return !(session.metadata?.excludedSourceIds ?? []).includes(sourceId)
}

export function toggleSourceForNote(
  metadata: NoteMetadata | undefined,
  sourceId: string,
  enabled: boolean,
): NoteMetadata {
  const excluded = new Set(metadata?.excludedSourceIds ?? [])
  if (enabled) excluded.delete(sourceId)
  else excluded.add(sourceId)
  return { ...metadata, excludedSourceIds: [...excluded] }
}

export function filterSourcesForNote(sources: NoteSource[], session: NoteSession): NoteSource[] {
  const excluded = new Set(session.metadata?.excludedSourceIds ?? [])
  return sources.filter((s) => !excluded.has(s.id))
}
