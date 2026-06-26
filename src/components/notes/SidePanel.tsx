'use client'

import { useCallback, useRef, useState } from 'react'
import type { Lookup, NoteHistoryEntry, NoteSession } from '@/lib/notes/types'
import { isLookupStreaming, type LookupStreamMap } from '@/lib/notes/lookupStreams'
import { collectTodos } from '@/lib/notes/rollup'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/notes/prefs'
import LookupConversation from './LookupConversation'
import CollapsibleSection from './CollapsibleSection'
import SyncPanel from './SyncPanel'
import DictionaryPanel from './DictionaryPanel'
import RollupPanel from './RollupPanel'
import FollowUpComposer from './FollowUpComposer'
import LookupComposer from './LookupComposer'
import SourcesPanel from './SourcesPanel'
import NoteHistoryPanel from './NoteHistoryPanel'
import NotesVaultPanel from './NotesVaultPanel'
import type { NoteFolder } from '@/lib/notes/types'
import { NotesRowAction } from './NotesActionUi'

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

const PANEL_MIN_WIDTH = 240
const PANEL_ABSOLUTE_MAX = 900
const PANEL_MIN_MAX = 800

function maxPanelWidth(): number {
  if (typeof window === 'undefined') return PANEL_ABSOLUTE_MAX
  const vwHalf = window.innerWidth * 0.5
  const viewportCap = window.innerWidth * 0.9
  return Math.min(PANEL_ABSOLUTE_MAX, viewportCap, Math.max(PANEL_MIN_MAX, vwHalf))
}

function clampPanelWidth(w: number): number {
  return Math.min(maxPanelWidth(), Math.max(PANEL_MIN_WIDTH, w))
}

type SidePanelProps = {
  isOpen: boolean
  sessions: NoteSession[]
  folders: NoteFolder[]
  expandedFolderIds: string[]
  activeSessionId: string
  activeSession: NoteSession
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
  rollupOpen: boolean
  noteHistory: NoteHistoryEntry[]
  glossaryRefreshKey: number
  onNotesListOpenChange: (open: boolean) => void
  onAiListOpenChange: (open: boolean) => void
  onSyncOpenChange: (open: boolean) => void
  onGlossaryOpenChange: (open: boolean) => void
  onSourcesOpenChange: (open: boolean) => void
  onHistoryOpenChange: (open: boolean) => void
  onRollupOpenChange: (open: boolean) => void
  onSelectMeeting: (session: NoteSession) => void
  onNewNote: (folderId: string | null) => void
  onNewFolder: (parentId: string | null, name: string) => void
  onDeleteFolder: (folderId: string) => void
  onMoveNote: (sessionId: string, folderId: string | null) => void
  onMoveFolder: (folderId: string, parentId: string | null) => void
  onToggleFolder: (folderId: string) => void
  onDeleteMeeting: (sessionId: string) => void
  onRenameMeeting: (sessionId: string, title: string) => void
  onArchiveNote: (sessionId: string) => void
  onDeleteLookup: (lookupId: string) => void
  onPanelLookup: (query: string) => void
  onFollowUp: (q: string) => void
  onSelectHistory: (lookup: Lookup) => void
  onClearLookup: () => void
  onSynced: (opts?: { skipPersist?: boolean; force?: boolean }) => void
  onJumpTodo: (sessionId: string, lineIndex: number) => void
  onArchiveTodo: (sessionId: string, lineIndex: number) => void
  onRestoreTodo: (sessionId: string, lineIndex: number) => void
  onToggleSourceForNote: (sourceId: string, enabled: boolean) => void
  onSourcesChange: () => void
  onDictionaryChange: () => void
}

export default function SidePanel({
  isOpen,
  sessions,
  folders,
  expandedFolderIds,
  activeSessionId,
  activeSession,
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
  rollupOpen,
  noteHistory,
  glossaryRefreshKey,
  onNotesListOpenChange,
  onAiListOpenChange,
  onSyncOpenChange,
  onGlossaryOpenChange,
  onSourcesOpenChange,
  onHistoryOpenChange,
  onRollupOpenChange,
  onSelectMeeting,
  onNewNote,
  onNewFolder,
  onDeleteFolder,
  onMoveNote,
  onMoveFolder,
  onToggleFolder,
  onDeleteMeeting,
  onRenameMeeting,
  onArchiveNote,
  onDeleteLookup,
  onPanelLookup,
  onFollowUp,
  onSelectHistory,
  onClearLookup,
  onSynced,
  onJumpTodo,
  onArchiveTodo,
  onRestoreTodo,
  onToggleSourceForNote,
  onSourcesChange,
  onDictionaryChange,
}: SidePanelProps) {
  const [width, setWidth] = useState(() =>
    clampPanelWidth(loadNotesUiPrefs().panelWidth ?? 300),
  )
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startW: width }
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = dragRef.current.startX - ev.clientX
        setWidth(clampPanelWidth(dragRef.current.startW + delta))
      }
      const onUp = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = dragRef.current.startX - ev.clientX
        const next = clampPanelWidth(dragRef.current.startW + delta)
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

  const todoCount = collectTodos(sessions).length

  return (
    <aside
      style={{ width }}
      className="notes-side-panel-mobile relative flex shrink-0 flex-col border-l border-[var(--uv-border)] bg-[var(--uv-bg-panel)] max-md:fixed max-md:top-0 max-md:right-0 max-md:z-30 max-md:h-[calc(100dvh-2.25rem-env(safe-area-inset-bottom))] max-md:shadow-xl max-md:pt-[env(safe-area-inset-top)]"
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto max-md:pt-2">
        <CollapsibleSection
          title="Notes"
          badge={String(sessions.length)}
          open={notesListOpen}
          onToggle={() => onNotesListOpenChange(!notesListOpen)}
          testId="notes-meetings-section"
          toggleTestId="notes-meetings-toggle"
        >
          <NotesVaultPanel
            sessions={sessions}
            folders={folders}
            activeSessionId={activeSessionId}
            expandedFolderIds={expandedFolderIds}
            onSelectMeeting={onSelectMeeting}
            onNewNote={onNewNote}
            onNewFolder={onNewFolder}
            onDeleteFolder={onDeleteFolder}
            onMoveNote={onMoveNote}
            onMoveFolder={onMoveFolder}
            onDeleteMeeting={onDeleteMeeting}
            onRenameMeeting={onRenameMeeting}
            onArchiveNote={onArchiveNote}
            onToggleFolder={onToggleFolder}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Todos"
          {...(todoCount ? { badge: String(todoCount) } : {})}
          open={rollupOpen}
          onToggle={() => onRollupOpenChange(!rollupOpen)}
          testId="notes-rollup-section"
          toggleTestId="notes-rollup-toggle"
        >
          <RollupPanel
            sessions={sessions}
            onJump={onJumpTodo}
            onArchiveTodo={onArchiveTodo}
            onRestoreTodo={onRestoreTodo}
            embedded
          />
        </CollapsibleSection>

        <CollapsibleSection
          title={aiTitle}
          open={aiListOpen}
          onToggle={() => onAiListOpenChange(!aiListOpen)}
          testId="notes-ai-section"
          toggleTestId="notes-ai-toggle"
        >
          <div className="px-3 pb-2">
            {focusedLookup ? (
              <div className="mb-3 flex min-h-0 flex-col">
                <div className="mb-1.5 flex shrink-0 items-center gap-1">
                  <p className="min-w-0 flex-1 text-[11px] text-[var(--uv-text-secondary)]">
                    {lookupLabel(focusedLookup)}
                  </p>
                  <button
                    type="button"
                    aria-label="New AI question"
                    data-testid="notes-clear-lookup"
                    onClick={onClearLookup}
                    className="shrink-0 rounded px-1 text-[10px] text-[var(--uv-text-muted)] hover:text-[var(--uv-text-primary)]"
                  >
                    New
                  </button>
                  <button
                    type="button"
                    aria-label="Delete this lookup"
                    data-testid="notes-delete-lookup-active"
                    onClick={() => onDeleteLookup(focusedLookup.id)}
                    className="shrink-0 rounded px-1 text-[10px] leading-none text-[var(--uv-text-muted)] hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
                <LookupConversation
                  lookup={focusedLookup}
                  streamText={streamText}
                  isStreaming={displayStreaming}
                  error={displayError}
                />
                {!displayStreaming ? <FollowUpComposer onSubmit={onFollowUp} /> : null}
              </div>
            ) : (
              <>
                <LookupComposer onSubmit={onPanelLookup} />
                <LookupConversation lookup={null} streamText="" isStreaming={false} error={displayError} />
              </>
            )}

            {sessionHistory.length > 0 ? (
              <div className={`border-[var(--uv-border)] pt-2 ${focusedLookup ? 'mt-2 border-t' : 'mt-4 border-t'}`}>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">
                  This note
                </p>
                <ul className="space-y-0.5">
                  {sessionHistory.map((lk) => {
                    const streaming = isLookupStreaming(streamByLookupId, lk.id)
                    const active = focusedLookup?.id === lk.id
                    return (
                      <li key={lk.id} className="group flex items-center gap-0.5">
                        <button
                          type="button"
                          data-testid={`notes-lookup-history-${lk.id}`}
                          data-active={active ? 'true' : 'false'}
                          onClick={() => onSelectHistory(lk)}
                          className={`flex min-w-0 flex-1 items-center gap-1 rounded px-1.5 py-1 text-left text-[11px] hover:bg-[var(--uv-accent-dim)] ${
                            active
                              ? 'notes-meeting-active text-[var(--uv-text-primary)]'
                              : 'text-[var(--uv-text-secondary)]'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {lookupLabel(lk)} · {timeAgo(lk.triggeredAt)}
                          </span>
                          {streaming ? (
                            <span className="shrink-0 text-[10px] text-[var(--uv-accent)]">…</span>
                          ) : null}
                        </button>
                        <NotesRowAction
                          label={`Delete ${lookupLabel(lk)}`}
                          testId={`notes-delete-lookup-${lk.id}`}
                          onClick={() => onDeleteLookup(lk.id)}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Dictionary"
          open={glossaryOpen}
          onToggle={() => onGlossaryOpenChange(!glossaryOpen)}
          testId="notes-glossary-section"
          toggleTestId="notes-glossary-toggle"
        >
          <DictionaryPanel
            refreshKey={glossaryRefreshKey}
            noteId={activeSessionId}
            onChange={onDictionaryChange}
            embedded
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Sources"
          open={sourcesOpen}
          onToggle={() => onSourcesOpenChange(!sourcesOpen)}
          testId="notes-sources-section"
          toggleTestId="notes-sources-toggle"
        >
          <SourcesPanel
            refreshKey={glossaryRefreshKey}
            session={activeSession}
            onToggleSourceForNote={onToggleSourceForNote}
            onChange={onSourcesChange}
            embedded
          />
        </CollapsibleSection>

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
