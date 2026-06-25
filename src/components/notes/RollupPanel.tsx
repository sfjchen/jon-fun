'use client'

import { useMemo, useState } from 'react'
import { collectArchivedTodosFromNotes } from '@/lib/notes/todoLines'
import { collectTodos } from '@/lib/notes/rollup'
import type { NoteSession, TodoRollupItem } from '@/lib/notes/types'

type RollupPanelProps = {
  sessions: NoteSession[]
  onJump: (sessionId: string, lineIndex: number) => void
  onArchiveTodo: (sessionId: string, lineIndex: number) => void
  onRestoreTodo: (sessionId: string, lineIndex: number) => void
  embedded?: boolean
}

function collectArchived(sessions: NoteSession[]): TodoRollupItem[] {
  const out: TodoRollupItem[] = []
  for (const s of sessions) {
    for (const { text, lineIndex } of collectArchivedTodosFromNotes(s.notes)) {
      out.push({
        sessionId: s.id,
        sessionTitle: s.title,
        meetingAt: s.startedAt,
        text,
        lineIndex,
      })
    }
  }
  return out.sort((a, b) => b.meetingAt.localeCompare(a.meetingAt))
}

export default function RollupPanel({
  sessions,
  onJump,
  onArchiveTodo,
  onRestoreTodo,
  embedded,
}: RollupPanelProps) {
  const active = collectTodos(sessions)
  const archived = useMemo(() => collectArchived(sessions), [sessions])
  const [archiveOpen, setArchiveOpen] = useState(false)

  return (
    <section className={embedded ? 'px-3 pb-2' : 'px-3 py-2'} data-testid="notes-rollup-panel">
      {!embedded ? (
        <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">All todos</p>
      ) : null}
      {active.length === 0 ? (
        <p className="text-[11px] text-[var(--uv-text-muted)]">No open todos — use suffix &gt; on a line.</p>
      ) : (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto">
          {active.map((t, i) => (
            <li key={`${t.sessionId}-${t.lineIndex}-${i}`} className="flex items-start gap-1.5">
              <input
                type="checkbox"
                aria-label={`Complete: ${t.text}`}
                data-testid={`notes-todo-check-${t.sessionId}-${t.lineIndex}`}
                className="mt-0.5 shrink-0 accent-[var(--uv-accent)]"
                onChange={() => onArchiveTodo(t.sessionId, t.lineIndex)}
              />
              <button
                type="button"
                onClick={() => onJump(t.sessionId, t.lineIndex)}
                className="min-w-0 flex-1 rounded px-0.5 py-0.5 text-left text-[11px] hover:bg-[var(--uv-bg-hover)]"
              >
                <span className="text-[var(--uv-text-muted)]">{t.sessionTitle || 'Untitled'} · </span>
                <span className="text-[var(--uv-text-secondary)]">{t.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <div className="mt-2 border-t border-[var(--uv-border)] pt-2">
          <button
            type="button"
            data-testid="notes-todo-archive-toggle"
            aria-expanded={archiveOpen}
            onClick={() => setArchiveOpen((o) => !o)}
            className="flex w-full items-center gap-1 text-left text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)] hover:text-[var(--uv-text-secondary)]"
          >
            <span className="inline-block w-3">{archiveOpen ? '▾' : '▸'}</span>
            Archive ({archived.length})
          </button>
          {archiveOpen ? (
            <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto" data-testid="notes-todo-archive-list">
              {archived.map((t, i) => (
                <li key={`arch-${t.sessionId}-${t.lineIndex}-${i}`} className="flex items-start gap-1.5">
                  <input
                    type="checkbox"
                    checked
                    aria-label={`Restore: ${t.text}`}
                    data-testid={`notes-todo-restore-${t.sessionId}-${t.lineIndex}`}
                    className="mt-0.5 shrink-0 accent-[var(--uv-accent)]"
                    onChange={() => onRestoreTodo(t.sessionId, t.lineIndex)}
                  />
                  <button
                    type="button"
                    onClick={() => onJump(t.sessionId, t.lineIndex)}
                    className="min-w-0 flex-1 rounded px-0.5 py-0.5 text-left text-[11px] line-through opacity-70 hover:bg-[var(--uv-bg-hover)]"
                  >
                    <span className="text-[var(--uv-text-muted)]">{t.sessionTitle || 'Untitled'} · </span>
                    <span className="text-[var(--uv-text-secondary)]">{t.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
