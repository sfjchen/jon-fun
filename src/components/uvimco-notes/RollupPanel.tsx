'use client'

import { collectTodos } from '@/lib/uvimco-notes/rollup'
import type { NoteSession } from '@/lib/uvimco-notes/types'

type RollupPanelProps = {
  sessions: NoteSession[]
  onJump: (sessionId: string, lineIndex: number) => void
}

export default function RollupPanel({ sessions, onJump }: RollupPanelProps) {
  const todos = collectTodos(sessions).slice(0, 20)

  return (
    <section className="px-3 py-2" data-testid="notes-rollup-panel">
      <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">All todos</p>
      {todos.length === 0 ? (
        <p className="text-[11px] text-[var(--uv-text-muted)]">No action items yet — use &gt; lines.</p>
      ) : (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto">
          {todos.map((t, i) => (
            <li key={`${t.sessionId}-${t.lineIndex}-${i}`}>
              <button
                type="button"
                onClick={() => onJump(t.sessionId, t.lineIndex)}
                className="w-full rounded px-1 py-0.5 text-left text-[11px] hover:bg-[var(--uv-bg-hover)]"
              >
                <span className="text-[var(--uv-text-muted)]">{t.sessionTitle} · </span>
                <span className="text-[var(--uv-text-secondary)]">{t.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
