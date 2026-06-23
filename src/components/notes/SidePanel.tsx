'use client'

import { useCallback, useRef, useState } from 'react'
import type { Lookup, NoteHistoryEntry, NoteSession } from '@/lib/notes/types'
import { isLookupStreaming, type LookupStreamMap } from '@/lib/notes/lookupStreams'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/notes/prefs'
import LookupConversation from './LookupConversation'
import CollapsibleSection from './CollapsibleSection'
import SyncPanel from './SyncPanel'
import GlossaryPanel from './GlossaryPanel'
import RollupPanel from './RollupPanel'
import FollowUpComposer from './FollowUpComposer'
import LookupComposer from './LookupComposer'
import SourcesPanel from './SourcesPanel'
import NoteHistoryPanel from './NoteHistoryPanel'

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
  focusedLookup: Lookup | null
  sessionHistory: Lookup[]
  streamByLookupId: LookupStreamMap
  streamText: string
  displayStreaming: boolean
  displayError: string | null
  aiActiveCount: number
  notesListOpen: boolean
  aiListOpen: boolean
  syncOpen: boolean
  glossaryOpen: boolean
  sourcesOpen: boolean
  historyOpen: boolean
  noteHistory: NoteHistoryEntry[]
  glossaryRefreshKey: number
  onNotesListOpenChange: (open: boolean) => void
  onAiListOpenChange: (open: boolean) => void
  onSyncOpenChange: (open: boolean) => void
  onGlossaryOpenChange: (open: boolean) => void
  onSourcesOpenChange: (open: boolean) => void
  onHistoryOpenChange: (open: boolean) => void
  onSelectMeeting: (session: NoteSession) => void
  onNewMeeting: () => void
  onDeleteMeeting: (sessionId: string) => void
  onDeleteLookup: (lookupId: string) => void
  onPanelLookup: (query: string) => void
  onFollowUp: (q: string) => void
  onSelectHistory: (lookup: Lookup) => void
  onClose: () => void
  onSynced: (opts?: { skipPersist?: boolean }) => void
  onJumpTodo: (sessionId: string, lineIndex: number) => void
  onSourcesChange: () => void
}

export default function SidePanel({
  isOpen,
  sessions,
  activeSessionId,
  focusedLookup,
  sessionHistory,
  streamByLookupId,
  streamText,
  displayStreaming,
  displayError,
  aiActiveCount,
  notesListOpen,
  aiListOpen,
  syncOpen,
  glossaryOpen,
  sourcesOpen,
  historyOpen,
  noteHistory,
  glossaryRefreshKey,
  onNotesListOpenChange,
  onAiListOpenChange,
  onSyncOpenChange,
  onGlossaryOpenChange,
  onSourcesOpenChange,
  onHistoryOpenChange,
  onSelectMeeting,
  onNewMeeting,
  onDeleteMeeting,
  onDeleteLookup,
  onPanelLookup,
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

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startW: width }
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = dragRef.current.startX - ev.clientX
        setWidth(Math.min(480, Math.max(240, dragRef.current.startW + delta)))
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

  const aiTitle =
    aiActiveCount > 1 ? `AI lookup · ${aiActiveCount} active` : 'AI lookup'

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

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Primary: AI answers (panel opens for this) */}
        <section className="border-b border-[var(--uv-border)] px-3 py-2" data-testid="notes-ai-section">
          <button
            type="button"
            onClick={() => onAiListOpenChange(!aiListOpen)}
            className="mb-2 flex w-full items-center justify-between text-left"
            aria-expanded={aiListOpen}
            data-testid="notes-ai-toggle"
          >
            <span className="text-xs font-medium text-[var(--uv-text-primary)]">{aiTitle}</span>
            <span className="text-[10px] text-[var(--uv-text-muted)]">{aiListOpen ? '▾' : '▸'}</span>
          </button>

          {aiListOpen ? (
            <>
              <LookupComposer onSubmit={onPanelLookup} />

              {focusedLookup ? (
                <div className="mb-3 flex min-h-0 flex-col">
                  <div className="mb-1.5 flex shrink-0 items-center gap-1">
                    <p className="min-w-0 flex-1 text-[11px] text-[var(--uv-text-secondary)]">
                      {lookupLabel(focusedLookup)}
                    </p>
                    <button
                      type="button"
                      aria-label="Delete this lookup"
                      data-testid="notes-delete-lookup-active"
                      onClick={() => onDeleteLookup(focusedLookup.id)}
                      className="shrink-0 rounded px-1 text-[var(--uv-text-muted)] hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                  <LookupConversation
                    lookup={focusedLookup}
                    streamText={streamText}
                    isStreaming={displayStreaming}
                    error={displayError}
                  />
                </div>
              ) : (
                <LookupConversation lookup={null} streamText="" isStreaming={false} error={displayError} />
              )}

              {focusedLookup && !displayStreaming ? (
                <FollowUpComposer onSubmit={onFollowUp} />
              ) : null}

              {sessionHistory.length > 0 ? (
                <div className="mt-4 border-t border-[var(--uv-border)] pt-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">
                    This note
                  </p>
                  <ul className="space-y-0.5">
                    {sessionHistory.map((lk) => {
                      const streaming = isLookupStreaming(streamByLookupId, lk.id)
                      return (
                        <li key={lk.id} className="group flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => onSelectHistory(lk)}
                            className="flex min-w-0 flex-1 items-center gap-1 rounded px-1.5 py-1 text-left text-[11px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-accent-dim)]"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {lookupLabel(lk)} · {timeAgo(lk.triggeredAt)}
                            </span>
                            {streaming ? (
                              <span className="shrink-0 text-[10px] text-[var(--uv-accent)]">…</span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${lookupLabel(lk)}`}
                            data-testid={`notes-delete-lookup-${lk.id}`}
                            onClick={() => onDeleteLookup(lk.id)}
                            className="shrink-0 rounded px-1 text-[10px] text-[var(--uv-text-muted)] hover:text-red-600"
                          >
                            ×
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        {/* Notes list — secondary */}
        <CollapsibleSection
          title="Notes"
          badge={String(sessions.length)}
          open={notesListOpen}
          onToggle={() => onNotesListOpenChange(!notesListOpen)}
          testId="notes-meetings-section"
          toggleTestId="notes-meetings-toggle"
        >
          <div className="px-2 pb-2">
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
            <ul className="max-h-40 space-y-0.5 overflow-y-auto">
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
                          ? 'notes-meeting-active text-[var(--uv-text-primary)]'
                          : 'text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)]'
                      }`}
                    >
                      <span className="block truncate">{s.title || 'Untitled'}</span>
                      <span className="text-[10px] text-[var(--uv-text-muted)]">
                        {formatMeetingDate(s.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${s.title || 'note'}`}
                      data-testid={`notes-delete-meeting-${s.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteMeeting(s.id)
                      }}
                      className="shrink-0 rounded px-1 text-[10px] text-[var(--uv-text-muted)] hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Glossary"
          open={glossaryOpen}
          onToggle={() => onGlossaryOpenChange(!glossaryOpen)}
          testId="notes-glossary-section"
          toggleTestId="notes-glossary-toggle"
        >
          <GlossaryPanel refreshKey={glossaryRefreshKey} embedded />
        </CollapsibleSection>

        <CollapsibleSection
          title="Sources"
          open={sourcesOpen}
          onToggle={() => onSourcesOpenChange(!sourcesOpen)}
          testId="notes-sources-section"
          toggleTestId="notes-sources-toggle"
        >
          <SourcesPanel refreshKey={glossaryRefreshKey} onChange={onSourcesChange} embedded />
        </CollapsibleSection>

        <RollupPanel sessions={sessions} onJump={onJumpTodo} />

        <CollapsibleSection
          title="History"
          {...(noteHistory.length ? { badge: String(noteHistory.length) } : {})}
          open={historyOpen}
          onToggle={() => onHistoryOpenChange(!historyOpen)}
          testId="notes-history-section"
          toggleTestId="notes-history-toggle"
        >
          <NoteHistoryPanel history={noteHistory} />
        </CollapsibleSection>

        {/* Sync — infrequent; bottom, collapsed by default */}
        <CollapsibleSection
          title="Sync & backup"
          open={syncOpen}
          onToggle={() => onSyncOpenChange(!syncOpen)}
          testId="notes-sync-section"
          toggleTestId="notes-sync-toggle"
          borderBottom={false}
        >
          <SyncPanel onSynced={onSynced} />
        </CollapsibleSection>
      </div>
    </aside>
  )
}
