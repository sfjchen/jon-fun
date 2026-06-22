'use client'

import { useCallback, useRef, useState } from 'react'
import type { Lookup, NoteSession, Screenshot } from '@/lib/uvimco-notes/types'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/uvimco-notes/prefs'
import AnswerStream from './AnswerStream'
import SyncPanel from './SyncPanel'
import GlossaryPanel from './GlossaryPanel'
import RollupPanel from './RollupPanel'
import SourcesPanel from './SourcesPanel'

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

function lookupLabel(lk: Lookup): string {
  if (lk.type === 'section') return `${lk.query}??`
  return `${lk.query}?`
}

type SidePanelProps = {
  isOpen: boolean
  sessions: NoteSession[]
  activeSessionId: string
  currentLookup: Lookup | null
  sessionHistory: Lookup[]
  streamText: string
  isStreaming: boolean
  streamError?: string | null
  notesListOpen: boolean
  aiListOpen: boolean
  glossaryRefreshKey: number
  onNotesListOpenChange: (open: boolean) => void
  onAiListOpenChange: (open: boolean) => void
  onSelectMeeting: (session: NoteSession) => void
  onNewMeeting: () => void
  onDeleteMeeting: (sessionId: string) => void
  onFollowUp: (q: string, screenshots?: Screenshot[]) => void
  onSelectHistory: (lookup: Lookup) => void
  onClose: () => void
  onSynced: () => void
  onJumpTodo: (sessionId: string, lineIndex: number) => void
  onSourcesChange: () => void
}

export default function SidePanel({
  isOpen,
  sessions,
  activeSessionId,
  currentLookup,
  sessionHistory,
  streamText,
  isStreaming,
  streamError,
  notesListOpen,
  aiListOpen,
  glossaryRefreshKey,
  onNotesListOpenChange,
  onAiListOpenChange,
  onSelectMeeting,
  onNewMeeting,
  onDeleteMeeting,
  onFollowUp,
  onSelectHistory,
  onClose,
  onSynced,
  onJumpTodo,
  onSourcesChange,
}: SidePanelProps) {
  const defaultWidth = loadNotesUiPrefs().panelWidth ?? 300
  const [width, setWidth] = useState(defaultWidth)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  const followShotsRef = useRef<Screenshot[]>([])

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startW: width }
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = dragRef.current.startX - ev.clientX
        const next = Math.min(480, Math.max(240, dragRef.current.startW + delta))
        setWidth(next)
      }
      const onUp = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = dragRef.current.startX - ev.clientX
        const next = Math.min(480, Math.max(240, dragRef.current.startW + delta))
        dragRef.current = null
        setWidth(next)
        saveNotesUiPrefs({ panelWidth: next })
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [width],
  )

  if (!isOpen) return null

  return (
    <aside
      style={{ width }}
      className="relative flex shrink-0 flex-col border-l border-[var(--uv-border)] bg-[var(--uv-bg-panel)] max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:shadow-xl"
      data-testid="notes-side-panel"
      aria-label="Notes and AI panel"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onResizeStart}
        className="absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize hover:bg-[var(--uv-accent-dim)] max-md:hidden"
        data-testid="notes-panel-resize"
      />
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
        <SyncPanel onSynced={onSynced} />

        <section data-testid="notes-meetings-section">
          <button
            type="button"
            onClick={() => onNotesListOpenChange(!notesListOpen)}
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--uv-bg-hover)]"
            aria-expanded={notesListOpen}
            data-testid="notes-meetings-toggle"
          >
            <span className="text-xs font-medium text-[var(--uv-text-primary)]">
              Notes
              <span className="ml-1.5 font-normal text-[var(--uv-text-muted)]">({sessions.length})</span>
            </span>
            <span className="text-[10px] text-[var(--uv-text-muted)]">{notesListOpen ? '▾' : '▸'}</span>
          </button>

          {notesListOpen ? (
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

        <section className="px-3 py-2">
          <button
            type="button"
            onClick={() => onAiListOpenChange(!aiListOpen)}
            className="mb-2 flex w-full items-center justify-between text-left"
            aria-expanded={aiListOpen}
            data-testid="notes-ai-toggle"
          >
            <span className="text-xs font-medium text-[var(--uv-text-primary)]">AI lookup</span>
            <span className="text-[10px] text-[var(--uv-text-muted)]">{aiListOpen ? '▾' : '▸'}</span>
          </button>

          {aiListOpen ? (
            <>
              {currentLookup ? (
                <div className="mb-3">
                  <p className="mb-1.5 text-[11px] text-[var(--uv-text-secondary)]">{lookupLabel(currentLookup)}</p>
                  <AnswerStream text={streamText} isStreaming={isStreaming} error={streamError ?? null} />
                </div>
              ) : (
                <AnswerStream text="" isStreaming={false} error={streamError ?? null} />
              )}

              {currentLookup && !isStreaming ? (
                <form
                  className="mt-2"
                  onPaste={(e) => {
                    const items = e.clipboardData?.items
                    if (!items) return
                    for (const item of items) {
                      if (!item.type.startsWith('image/')) continue
                      e.preventDefault()
                      const file = item.getAsFile()
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => {
                        const dataUrl = reader.result as string
                        const base64 = dataUrl.split(',')[1] ?? ''
                        followShotsRef.current.push({
                          id: `follow-shot-${Date.now()}`,
                          base64,
                          mimeType: file.type,
                        })
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    const q = String(fd.get('followup') ?? '').trim()
                    if (q) {
                      const shots = [...followShotsRef.current]
                      followShotsRef.current = []
                      onFollowUp(q, shots.length ? shots : undefined)
                      e.currentTarget.reset()
                    }
                  }}
                >
                  <input
                    name="followup"
                    placeholder="Follow-up ↵ (paste screenshot)"
                    data-testid="notes-followup-input"
                    className="w-full rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1.5 text-sm text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:border-[var(--uv-accent)] focus:outline-none"
                  />
                </form>
              ) : null}

              {sessionHistory.length > 0 ? (
                <div className="mt-4 border-t border-[var(--uv-border)] pt-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">This note</p>
                  <ul className="space-y-0.5">
                    {sessionHistory.map((lk) => (
                      <li key={lk.id}>
                        <button
                          type="button"
                          onClick={() => onSelectHistory(lk)}
                          className="w-full rounded px-1.5 py-1 text-left text-[11px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-accent-dim)]"
                        >
                          {lookupLabel(lk)} · {timeAgo(lk.triggeredAt)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        <GlossaryPanel refreshKey={glossaryRefreshKey} />
        <SourcesPanel onChange={onSourcesChange} />
        <RollupPanel sessions={sessions} onJump={onJumpTodo} />
      </div>
    </aside>
  )
}
