'use client'

type LookupComposerProps = {
  onSubmit: (query: string) => void
  disabled?: boolean
}

export default function LookupComposer({ onSubmit, disabled }: LookupComposerProps) {
  return (
    <form
      className="mb-3"
      data-testid="notes-lookup-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (disabled) return
        const fd = new FormData(e.currentTarget)
        const q = String(fd.get('lookup') ?? '').trim()
        if (!q) return
        onSubmit(q)
        e.currentTarget.reset()
      }}
    >
      <input
        name="lookup"
        placeholder="Lookup term or question ↵"
        data-testid="notes-lookup-input"
        disabled={disabled}
        className="w-full rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1.5 text-sm text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:border-[var(--uv-accent)] focus:outline-none disabled:opacity-50"
      />
    </form>
  )
}
