'use client'

type NotesHeaderProps = {
  panelOpen: boolean
  onTogglePanel: () => void
  onExport: () => void
  onDecodeAll: () => void
  onNewNote: () => void
  homeLink: React.ReactNode
}

export default function NotesHeader({
  panelOpen,
  onTogglePanel,
  onExport,
  onDecodeAll,
  onNewNote,
  homeLink,
}: NotesHeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-3">
      <div className="flex min-w-0 items-center gap-2">{homeLink}</div>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onNewNote}
          data-testid="notes-header-new"
          className="hidden rounded border border-[var(--uv-border)] px-2 py-1 text-[11px] text-[var(--uv-text-secondary)] hover:text-[var(--uv-text-primary)] sm:inline"
          title="New note (Ctrl+Shift+N)"
        >
          New
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded border border-[var(--uv-border)] px-2 py-1 text-[11px] text-[var(--uv-text-secondary)] hover:text-[var(--uv-text-primary)]"
          title="Export markdown (Ctrl+S)"
        >
          Export
        </button>
        <button
          type="button"
          onClick={onDecodeAll}
          className="hidden rounded border border-[var(--uv-border)] px-2 py-1 text-[11px] text-[var(--uv-text-secondary)] sm:inline"
          title="Decode all (Ctrl+K)"
        >
          Decode
        </button>
        <button
          type="button"
          onClick={onTogglePanel}
          data-testid="notes-toggle-panel"
          className="rounded border border-transparent px-2 py-1 text-[11px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)]"
          title="Notes & AI panel (Ctrl+\)"
        >
          {panelOpen ? 'Hide panel' : 'Panel'}
        </button>
      </div>
    </header>
  )
}
