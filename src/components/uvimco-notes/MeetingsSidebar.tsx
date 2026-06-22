'use client'

import type { NoteSession } from '@/lib/uvimco-notes/types'

function formatMeetingDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type MeetingsSidebarProps = {
  sessions: NoteSession[]
  activeSessionId: string
  onSelect: (session: NoteSession) => void
  onNew: () => void
  onDelete: (sessionId: string) => void
}

export default function MeetingsSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
}: MeetingsSidebarProps) {
  return (
    <aside
      className="flex w-[220px] shrink-0 flex-col border-r border-[var(--uv-border)] bg-[var(--uv-bg-sidebar)] max-md:w-[150px] md:relative"
      data-testid="uvimco-meetings-sidebar"
      aria-label="Meeting notes"
    >
      <div className="flex items-center justify-between border-b border-[var(--uv-border)] px-3 py-2.5">
        <span className="text-xs font-semibold text-[var(--uv-text-primary)]">Meetings</span>
        <button
          type="button"
          onClick={onNew}
          data-testid="uvimco-new-meeting"
          className="rounded px-2 py-0.5 text-xs font-medium text-[var(--uv-accent)] hover:bg-[var(--uv-accent-dim)]"
        >
          + New
        </button>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <li className="px-2 py-3 text-xs text-[var(--uv-text-secondary)]">No meetings yet.</li>
        ) : (
          sessions.map((s) => {
            const active = s.id === activeSessionId
            return (
              <li key={s.id} className="group flex items-center gap-0.5">
                <button
                  type="button"
                  data-testid={`uvimco-meeting-item-${s.id}`}
                  data-active={active ? 'true' : 'false'}
                  onClick={() => onSelect(s)}
                  className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                    active
                      ? 'uvimco-meeting-active text-[var(--uv-text-primary)]'
                      : 'text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)]'
                  }`}
                  title={s.title || 'Untitled meeting'}
                >
                  <span className="block truncate">{s.title || 'Untitled meeting'}</span>
                  <span className="text-[10px] text-[var(--uv-text-muted)]">{formatMeetingDate(s.updatedAt)}</span>
                </button>
                {sessions.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Delete ${s.title || 'meeting'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm('Delete this meeting note?')) onDelete(s.id)
                    }}
                    className="hidden shrink-0 rounded px-1 text-[var(--uv-text-muted)] hover:bg-red-50 hover:text-red-600 group-hover:inline"
                  >
                    ×
                  </button>
                ) : null}
              </li>
            )
          })
        )}
      </ul>
    </aside>
  )
}
