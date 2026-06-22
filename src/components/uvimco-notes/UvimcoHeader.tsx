'use client'

type HeaderProps = {
  panelOpen: boolean
  onTogglePanel: () => void
  onExport: () => void
  onDecodeAll: () => void
  syncOk: boolean | null
}

export default function UvimcoHeader({ panelOpen, onTogglePanel, onExport, onDecodeAll, syncOk }: HeaderProps) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-3">
      {syncOk === false ? (
        <span className="text-[10px] text-amber-700" title="Cloud sync failed — notes saved locally">
          offline
        </span>
      ) : (
        <span className="text-[10px] text-[var(--uv-text-muted)]">Saved</span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded border border-[var(--uv-border)] px-2 py-0.5 text-[10px] text-[var(--uv-text-secondary)] hover:border-[var(--uv-border-hover)] hover:text-[var(--uv-text-primary)]"
          title="Export markdown (Ctrl+S)"
        >
          Export .md
        </button>
        <button
          type="button"
          onClick={onDecodeAll}
          className="hidden rounded border border-[var(--uv-border)] px-2 py-0.5 text-[10px] text-[var(--uv-text-secondary)] hover:border-[var(--uv-border-hover)] sm:inline"
          title="Decode all (Ctrl+K)"
        >
          Decode
        </button>
        <button
          type="button"
          onClick={onTogglePanel}
          data-testid="uvimco-toggle-ai"
          className="rounded px-2 py-0.5 text-[10px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)]"
          title="Toggle AI panel (Ctrl+\\)"
        >
          {panelOpen ? 'Hide AI' : 'Show AI'}
        </button>
      </div>
    </header>
  )
}
