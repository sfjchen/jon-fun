import type { NoteHistoryEntry, NoteSession } from './types'
import { sanitizeHistoryDetail } from './textSanitize'

const MAX_ENTRIES = 120

/** Switch-only history must not bump updatedAt — vault sort stays stable when browsing notes. */
const BUMP_UPDATED_AT: Record<NoteHistoryEntry['kind'], boolean> = {
  created: true,
  saved: true,
  synced: true,
  lookup: true,
  title: true,
  tags: true,
  switch: false,
}

export function appendNoteHistory(
  session: NoteSession,
  entry: Omit<NoteHistoryEntry, 'at'> & { at?: string },
): NoteSession {
  const row: NoteHistoryEntry = {
    ...entry,
    at: entry.at ?? new Date().toISOString(),
  }
  const history = [...(session.history ?? []), row].slice(-MAX_ENTRIES)
  return BUMP_UPDATED_AT[entry.kind]
    ? { ...session, history, updatedAt: row.at }
    : { ...session, history }
}

export function lastHistoryEntry(
  session: NoteSession,
  kind?: NoteHistoryEntry['kind'],
): NoteHistoryEntry | null {
  const hist = session.history ?? []
  if (!kind) return hist[hist.length - 1] ?? null
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i]!.kind === kind) return hist[i]!
  }
  return null
}

export function formatHistoryLine(entry: NoteHistoryEntry): string {
  const t = new Date(entry.at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const labels: Record<NoteHistoryEntry['kind'], string> = {
    created: 'Created',
    saved: 'Saved locally',
    synced: 'Synced',
    lookup: 'AI lookup',
    title: 'Title edited',
    tags: 'Tags updated',
    switch: 'Opened note',
  }
  let label = labels[entry.kind] ?? entry.kind
  if (entry.detail) label += ` · ${sanitizeHistoryDetail(entry.detail)}`
  return `${t} — ${label}`
}
