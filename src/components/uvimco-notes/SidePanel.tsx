'use client'

import { useState } from 'react'
import type { Lookup, NoteSession } from '@/lib/uvimco-notes/types'
import AnswerStream from './AnswerStream'

function formatMeetingDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

type SidePanelProps = {
  isOpen: boolean
  sessions: NoteSession[]
  activeSessionId: string
  currentLookup: Lookup | null
  sessionHistory: Lookup[]
  streamText: string
  isStreaming: boolean
  onSelectMeeting: (session: NoteSession) => void
  onNewMeeting: () => void
  onDeleteMeeting: (sessionId: string) => void
  onFollowUp: (q: string) => void
  onSelectHistory: (lookup: Lookup) => void
  onClose: () => void
}

export default function SidePanel({
  isOpen,
  sessions,
  activeSessionId,
  currentLookup,
  sessionHistory,
  streamText,
  isStreaming,
  onSelectMeeting,
  onNewMeeting,
  onDeleteMeeting,
  onFollowUp,
  onSelectHistory,
  onClose,
}: SidePanelProps) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(true)

  if (!isOpen) return null

  return (
    <aside
      className="flex w-[min(100%,280px)] shrink-0 flex-col border-l border-[var(--uv-border)] bg-[var(--uv-bg-panel)] max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:shadow-xl"
      data-testid="notes-side-panel"
      aria-label="Notes and AI panel"
    >
      <div className="flex items-center justify-between border-b border-[var(--uv-border)] px-3 py-2">
        <span className="text-xs font-semibold text-[var(--uv-text-secondary)]">Panel</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-[var(--uv-text-muted)] hover:text-[var(--uv-text-primary)]"
          aria-label="Close panel"
          data-testid="notes-panel-close"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Notes — collapsed by default */}
        <section data-testid="notes-meetings-section">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--uv-bg-hover)]"
            aria-expanded={notesOpen}
            data-testid="notes-meetings-toggle"
          >
            <span className="text-xs font-medium text-[var(--uv-text-primary)]">
              Notes
              <span className="ml-1.5 font-normal text-[var(--uv-text-muted)]">({sessions.length})</span>
            </span>
            <span className="text-[10px] text-[var(--uv-text-muted)]">{notesOpen ? '▾' : '▸'}</span>
          </button>

          {notesOpen ? (
            <div className="border-b border-[var(--uv-border)] px-2 pb-2">
              <div className="mb-1 flex justify-end">
                <button
                  type="button"
                  onClick={onNewMeeting}
                  data-testid="notes-new-meeting"
                  className="rounded px-2 py-0.5 text-[11px] font-medium text-[var(--uv-accent)] hover:bg-[var(--uv-accent-dim)]"
                >
                  + New note
                </button>
              </div>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                {sessions.map((s) => {
                  const active = s.id === activeSessionId
                  return (
                    <li key={s.id} className="group flex items-center gap-0.5">
                      <button
                        type="button"
                        data-testid={`notes-meeting-item-${s.id}`}
                        data-active={active ? 'true' : 'false'}
                        onClick={() => onSelectMeeting(s)}
                        className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-xs ${
                          active
                            ? 'uvimco-meeting-active text-[var(--uv-text-primary)]'
                            : 'text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)]'
                        }`}
                      >
                        <span className="block truncate">{s.title || 'Untitled'}</span>
                        <span className="text-[10px] text-[var(--uv-text-muted)]">
                          {formatMeetingDate(s.updatedAt)}
                        </span>
                      </button>
                      {sessions.length > 1 ? (
                        <button
                          type="button"
                          aria-label={`Delete ${s.title || 'note'}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm('Delete this note?')) onDeleteMeeting(s.id)
                          }}
                          className="hidden shrink-0 rounded px-1 text-[var(--uv-text-muted)] hover:text-red-600 group-hover:inline"
                        >
                          ×
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </section>

        {/* AI lookup — collapsible */}
        <section className="px-3 py-2">
          <button
            type="button"
            onClick={() => setAiOpen((v) => !v)}
            className="mb-2 flex w-full items-center justify-between text-left"
            aria-expanded={aiOpen}
            data-testid="notes-ai-toggle"
          >
            <span className="text-xs font-medium text-[var(--uv-text-primary)]">AI lookup</span>
            <span className="text-[10px] text-[var(--uv-text-muted)]">{aiOpen ? '▾' : '▸'}</span>
          </button>

          {aiOpen ? (
            <>
              {currentLookup ? (
                <div className="mb-3">
                  <p className="mb-1.5 text-[11px] text-[var(--uv-text-secondary)]">
                    {currentLookup.type === 'word' ? `?${currentLookup.query}` : `${currentLookup.query}?`}
                  </p>
                  <AnswerStream text={streamText} isStreaming={isStreaming} />
                </div>
              ) : (
                <AnswerStream text="" isStreaming={false} />
              )}

              {currentLookup && !isStreaming ? (
                <form
                  className="mt-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    const q = String(fd.get('followup') ?? '').trim()
                    if (q) {
                      onFollowUp(q)
                      e.currentTarget.reset()
                    }
                  }}
                >
                  <input
                    name="followup"
                    placeholder="Follow-up ↵"
                    data-testid="notes-followup-input"
                    className="w-full rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1.5 text-sm text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:border-[var(--uv-accent)] focus:outline-none"
                  />
                </form>
              ) : null}

              {sessionHistory.length > 0 ? (
                <div className="mt-4 border-t border-[var(--uv-border)] pt-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">
                    This note
                  </p>
                  <ul className="space-y-0.5">
                    {sessionHistory.map((lk) => (
                      <li key={lk.id}>
                        <button
                          type="button"
                          onClick={() => onSelectHistory(lk)}
                          className="w-full rounded px-1.5 py-1 text-left text-[11px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-accent-dim)]"
                        >
                          {lk.type === 'word' ? `?${lk.query}` : 'line?'} · {timeAgo(lk.triggeredAt)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </aside>
  )
}
