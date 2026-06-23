'use client'

import { formatHistoryLine } from '@/lib/notes/noteHistory'
import { NOTES_SHORTCUTS } from '@/lib/notes/shortcuts'
import type { NoteHistoryEntry } from '@/lib/notes/types'
import ExportMenu from './ExportMenu'

type StatusBarProps = {
  chars: number
  flags: number
  actions: number
  syncOk: boolean | null
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
  let syncLabel = ''
  if (syncing) syncLabel = 'Syncing…'
  else if (saving) syncLabel = 'Saving…'
  else if (syncOk === false) syncLabel = 'Sync failed — saved locally'
  else if (syncOk === true) syncLabel = 'Saved'

  return (
    <footer
      className="flex min-h-7 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--uv-border)] bg-[var(--uv-bg-sidebar)] px-3 py-1 text-[10px] text-[var(--uv-text-secondary)] sm:px-4"
      data-testid="notes-statusbar"
    >
      <span>{chars} chars</span>
      <span>{flags} ?</span>
      <span>{actions} todos</span>
      {aiActiveCount > 0 ? (
        <span className="text-[var(--uv-accent)]" data-testid="notes-ai-active-count">
          {aiActiveCount} AI…
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
        <ActionBtn testId="notes-search-btn" label="Search" keys={NOTES_SHORTCUTS.search} onClick={onSearch} />
        <ActionBtn
          testId="notes-header-new"
          label="New"
          keys={NOTES_SHORTCUTS.newNote}
          onClick={onNewNote}
          className="hidden sm:inline-flex"
        />
        <ExportMenu
          onExportMd={onExportMd}
          onExportPdf={onExportPdf}
          {...(pdfExportBusy ? { pdfBusy: true } : {})}
        />
        <ActionBtn
          testId="notes-summarize-btn"
          label="Summarize"
          keys={NOTES_SHORTCUTS.summarize}
          onClick={onSummarize}
          className="hidden sm:inline-flex"
        />
        <ActionBtn
          testId="notes-toggle-panel"
          label={panelOpen ? 'Hide panel' : 'Panel'}
          keys={NOTES_SHORTCUTS.panel}
          onClick={onTogglePanel}
        />
        <button
          type="button"
          onClick={onHintsToggle}
          data-testid="notes-shorthand-toggle"
          className="inline-flex items-center gap-1 rounded border border-[var(--uv-border)] px-1.5 py-0.5 hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)]"
          aria-expanded={hintsOpen}
        >
          {hintsOpen ? 'Hide hints' : 'Hints'}
          <kbd className="text-[9px] text-[var(--uv-text-muted)]">{NOTES_SHORTCUTS.hints}</kbd>
        </button>
      </div>
    </footer>
  )
}

function ActionBtn({
  label,
  keys,
  onClick,
  testId,
  className = '',
}: {
  label: string
  keys?: string
  onClick: () => void
  testId?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(testId ? { 'data-testid': testId } : {})}
      className={`inline-flex items-center gap-1 rounded border border-[var(--uv-border)] px-1.5 py-0.5 hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)] ${className}`}
    >
      {label}
      {keys ? <kbd className="text-[9px] text-[var(--uv-text-muted)]">{keys}</kbd> : null}
    </button>
  )
}
