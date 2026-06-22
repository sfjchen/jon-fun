'use client'

type HeaderProps = {
  title: string
  onTitleChange: (t: string) => void
  panelOpen: boolean
  onTogglePanel: () => void
  onExport: () => void
  onDecodeAll: () => void
  syncOk: boolean | null
}

export default function UvimcoHeader({
  title,
  onTitleChange,
  panelOpen,
  onTogglePanel,
  onExport,
  onDecodeAll,
  syncOk,
}: HeaderProps) {
  const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-4">
      <span className="text-sm font-bold text-[var(--uv-accent)]" title="UVIMCO">
        UV
      </span>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:outline-none"
        placeholder="Meeting title"
        aria-label="Session title"
      />
      <span className="hidden text-xs text-[var(--uv-text-muted)] sm:inline">{dateStr}</span>
      {syncOk === false ? (
        <span className="text-[10px] text-amber-400" title="Cloud sync failed — notes saved locally">
          offline
        </span>
      ) : (
        <span className="text-[10px] text-[var(--uv-text-muted)]">● live</span>
      )}
      <button
        type="button"
        onClick={onExport}
        className="rounded border border-[var(--uv-border)] px-2 py-0.5 text-[10px] text-[var(--uv-text-secondary)] hover:border-[var(--uv-border-hover)]"
        title="Export markdown (⌘S)"
      >
        .md
      </button>
      <button
        type="button"
        onClick={onDecodeAll}
        className="hidden rounded border border-[var(--uv-border)] px-2 py-0.5 text-[10px] text-[var(--uv-text-secondary)] hover:border-[var(--uv-border-hover)] sm:inline"
        title="Decode all (⌘K)"
      >
        Decode
      </button>
      <button
        type="button"
        onClick={onTogglePanel}
        className="rounded px-2 py-0.5 text-[10px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-accent-dim)]"
        title="Toggle AI panel (⌘\\)"
      >
        {panelOpen ? 'Hide AI' : 'Show AI'}
      </button>
    </header>
  )
}
