'use client'

import { formatHistoryLine } from '@/lib/notes/noteHistory'
import type { NoteHistoryEntry } from '@/lib/notes/types'

type NoteHistoryPanelProps = {
  history: NoteHistoryEntry[]
}

export default function NoteHistoryPanel({ history }: NoteHistoryPanelProps) {
  const rows = [...history].reverse().slice(0, 40)

  return (
    <section className="px-3 py-2" data-testid="notes-history-panel">
      <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">Note history</p>
      {rows.length === 0 ? (
        <p className="text-[11px] text-[var(--uv-text-muted)]">Creates, saves, syncs, and AI lookups appear here.</p>
      ) : (
        <ul className="max-h-36 space-y-0.5 overflow-y-auto">
          {rows.map((h, i) => (
            <li key={`${h.at}-${h.kind}-${i}`} className="text-[10px] text-[var(--uv-text-secondary)]">
              {formatHistoryLine(h)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
