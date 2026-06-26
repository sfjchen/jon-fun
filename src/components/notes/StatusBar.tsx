'use client'

import { getDeviceDisplayName } from '@/lib/notes/deviceIdentity'
import { formatHistoryLine } from '@/lib/notes/noteHistory'
import { notesShortcutLabel } from '@/lib/notes/shortcuts'
import { useNotesDevice } from '@/lib/notes/useNotesDevice'
import type { NoteHistoryEntry } from '@/lib/notes/types'
import ExportMenu from './ExportMenu'

type StatusBarProps = {
  chars: number
  flags: number
  actions: number
  syncOk: boolean | null
  syncKind?: 'saved' | 'synced' | null
  saving: boolean
  syncing?: boolean
  aiActiveCount?: number
  lastHistory?: NoteHistoryEntry | null
  hintsOpen: boolean
  panelOpen: boolean
  pdfExportBusy?: boolean
  onSearch: () => void
  onNewNote: () => void
  onExportMd: () => void
  onExportPdf: () => Promise<void>
  onSummarize: () => void
  onTogglePanel: () => void
  onHintsToggle: () => void
}

const HINT_ITEMS = [
  { sym: 'line?', desc: 'AI line' },
  { sym: 'line??', desc: 'AI section' },
  { sym: 'text>', desc: 'todo' },
  { sym: '*text*', desc: 'highlight' },
]

export default function StatusBar({
  chars,
  flags,
  actions,
  syncOk,
  syncKind,
  saving,
  syncing,
  aiActiveCount = 0,
  lastHistory,
  hintsOpen,
  panelOpen,
  onSearch,
  onNewNote,
  onExportMd,
  onExportPdf,
  pdfExportBusy,
  onSummarize,
  onTogglePanel,
  onHintsToggle,
}: StatusBarProps) {
  const { isMobile } = useNotesDevice()
  const deviceName = getDeviceDisplayName()
  let syncLabel = ''
  if (syncing) syncLabel = 'Syncing…'
  else if (saving) syncLabel = 'Saving…'
  else if (syncOk === false) syncLabel = 'Sync failed — saved locally'
  else if (syncOk === true) syncLabel = syncKind === 'synced' ? 'Synced' : 'Saved'

  return (
    <footer
      className="notes-statusbar-mobile flex min-h-7 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--uv-border)] bg-[var(--uv-bg-sidebar)] px-3 py-1 text-[10px] text-[var(--uv-text-secondary)] sm:px-4"
      data-testid="notes-statusbar"
    >
      <span title="Character count">{chars} chars</span>
      <span title="Lines with ? or ?? AI triggers">{flags} ?</span>
      <span title="Todo lines (suffix &gt;)">{actions} todos</span>
      <span
        className="hidden text-[var(--uv-text-muted)] sm:inline"
        data-testid="notes-statusbar-device"
        title="This browser device"
      >
        {deviceName}
      </span>
      {aiActiveCount > 0 ? (
        <span className="text-[var(--uv-accent)]" data-testid="notes-ai-active-count">
          {aiActiveCount} AI active
        </span>
      ) : null}
      {syncLabel ? (
        <span
          data-testid="notes-sync-label"
          className={syncOk === false && !syncing ? 'text-amber-800' : 'text-[var(--uv-text-muted)]'}
          title={lastHistory ? formatHistoryLine(lastHistory) : undefined}
        >
          {syncLabel}
        </span>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-1">
        {hintsOpen ? (
          <span className="hidden items-center gap-2 border-r border-[var(--uv-border)] pr-2 lg:flex">
            {HINT_ITEMS.map((it) => (
              <span key={it.sym}>
                <code className="text-[var(--uv-accent-strong)]">{it.sym}</code>
                <span className="ml-0.5 text-[var(--uv-text-muted)]">{it.desc}</span>
              </span>
            ))}
          </span>
        ) : null}
        <ActionBtn
          testId="notes-search-btn"
          label="Search"
          keys={notesShortcutLabel('search')}
          hideKeys={isMobile}
          onClick={onSearch}
        />
        <ActionBtn
          testId="notes-header-new"
          label="New"
          keys={notesShortcutLabel('newNote')}
          hideKeys={isMobile}
          onClick={onNewNote}
        />
        <ExportMenu
          onExportMd={onExportMd}
          onExportPdf={onExportPdf}
          hideShortcut={isMobile}
          {...(pdfExportBusy ? { pdfBusy: true } : {})}
        />
        <ActionBtn
          testId="notes-summarize-btn"
          label="Summarize"
          keys={notesShortcutLabel('summarize')}
          hideKeys={isMobile}
          onClick={onSummarize}
          className="hidden sm:inline-flex"
        />
        <ActionBtn
          testId="notes-toggle-panel"
          label={panelOpen ? 'Hide panel' : isMobile ? 'Notes' : 'Panel'}
          keys={notesShortcutLabel('panel')}
          hideKeys={isMobile}
          onClick={onTogglePanel}
        />
        <button
          type="button"
          onClick={onHintsToggle}
          data-testid="notes-shorthand-toggle"
          className="inline-flex min-h-9 items-center gap-1 rounded border border-[var(--uv-border)] px-1.5 py-0.5 hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)] md:min-h-0"
          aria-expanded={hintsOpen}
        >
          {hintsOpen ? 'Hide hints' : 'Hints'}
          {!isMobile ? (
            <kbd className="text-[9px] text-[var(--uv-text-muted)]">{notesShortcutLabel('hints')}</kbd>
          ) : null}
        </button>
      </div>
    </footer>
  )
}

function ActionBtn({
  label,
  keys,
  hideKeys,
  onClick,
  testId,
  className = '',
}: {
  label: string
  keys?: string
  hideKeys?: boolean
  onClick: () => void
  testId?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onClick()}
      {...(testId ? { 'data-testid': testId } : {})}
      className={`inline-flex min-h-9 items-center gap-1 rounded border border-[var(--uv-border)] px-1.5 py-0.5 hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)] md:min-h-0 ${className}`}
    >
      {label}
      {keys && !hideKeys ? <kbd className="text-[9px] text-[var(--uv-text-muted)]">{keys}</kbd> : null}
    </button>
  )
}
