'use client'

type CollapsibleSectionProps = {
  title: string
  open: boolean
  onToggle: () => void
  testId: string
  toggleTestId?: string
  badge?: string
  children: React.ReactNode
  borderBottom?: boolean
}

export default function CollapsibleSection({
  title,
  open,
  onToggle,
  testId,
  toggleTestId,
  badge,
  children,
  borderBottom = true,
}: CollapsibleSectionProps) {
  return (
    <section
      className={borderBottom ? 'border-b border-[var(--uv-border)]' : ''}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--uv-bg-hover)]"
        aria-expanded={open}
        data-testid={toggleTestId ?? `${testId}-toggle`}
      >
        <span className="text-xs font-medium text-[var(--uv-text-primary)]">
          {title}
          {badge ? (
            <span className="ml-1.5 font-normal text-[var(--uv-text-muted)]">({badge})</span>
          ) : null}
        </span>
        <span className="text-[10px] text-[var(--uv-text-muted)]">{open ? '▾' : '▸'}</span>
      </button>
      {open ? children : null}
    </section>
  )
}
