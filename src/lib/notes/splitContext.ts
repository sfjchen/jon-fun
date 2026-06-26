import type { NoteSession } from './types'

/** Combined note body for AI lookup when split view is open. */
export function formatSplitFullNotes(primary: NoteSession, secondary: NoteSession | null): string {
  if (!secondary) return primary.notes
  const left = primary.title.trim() || 'Untitled'
  const right = secondary.title.trim() || 'Untitled'
  return `--- ${left} ---\n${primary.notes}\n\n--- ${right} ---\n${secondary.notes}`
}

export function mergeSplitTags(primary: NoteSession, secondary: NoteSession | null): string[] {
  if (!secondary) return primary.tags ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of [...(primary.tags ?? []), ...(secondary.tags ?? [])]) {
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export function mergeSplitTitle(primary: NoteSession, secondary: NoteSession | null): string {
  if (!secondary) return primary.title
  const left = primary.title.trim() || 'Untitled'
  const right = secondary.title.trim() || 'Untitled'
  return `${left} + ${right}`
}

/** Merge editor-local trigger context with the other open note when split. */
export function mergeSplitEditorContext(
  localContext: string,
  primary: NoteSession,
  secondary: NoteSession | null,
  fromPane: 'left' | 'right',
): string {
  if (!secondary) return localContext
  const other = fromPane === 'left' ? secondary : primary
  const otherTitle = other.title.trim() || 'Untitled'
  const otherBlock = `--- ${otherTitle} ---\n${other.notes}`
  return `${localContext}\n\n${otherBlock}`
}

export function splitCompanionSession(
  primary: NoteSession,
  sessions: NoteSession[],
  splitSessionId: string | null,
): NoteSession | null {
  if (!splitSessionId || splitSessionId === primary.id) return null
  return sessions.find((s) => s.id === splitSessionId) ?? null
}
