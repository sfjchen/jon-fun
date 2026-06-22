'use client'

type HeaderProps = {
  panelOpen: boolean
  onTogglePanel: () => void
  onExport: () => void
  onDecodeAll: () => void
  syncOk: boolean | null
  homeLink: React.ReactNode
}

export default function UvimcoHeader({
  panelOpen,
  onTogglePanel,
  onExport,
  onDecodeAll,
  syncOk,
  homeLink,
}: HeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-3">
      <div className="flex min-w-0 items-center gap-2">{homeLink}</div>
      {syncOk === false ? (
        <span className="text-[10px] text-amber-700" title="Cloud sync failed — notes saved on this device">
          sync off
        </span>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded border border-[var(--uv-border)] px-2 py-1 text-[11px] text-[var(--uv-text-secondary)] hover:border-[var(--uv-border-hover)] hover:text-[var(--uv-text-primary)]"
          title="Export markdown (Ctrl+S)"
        >
          Export .md
        </button>
        <button
          type="button"
          onClick={onDecodeAll}
          className="hidden rounded border border-[var(--uv-border)] px-2 py-1 text-[11px] text-[var(--uv-text-secondary)] hover:border-[var(--uv-border-hover)] sm:inline"
          title="Decode all (Ctrl+K)"
        >
          Decode
        </button>
        <button
          type="button"
          onClick={onTogglePanel}
          data-testid="uvimco-toggle-ai"
          className="rounded border border-transparent px-2 py-1 text-[11px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)]"
          title="Toggle AI panel (Ctrl+\\)"
        >
          {panelOpen ? 'Hide AI' : 'Show AI'}
        </button>
      </div>
    </header>
  )
}
