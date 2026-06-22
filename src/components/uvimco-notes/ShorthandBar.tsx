'use client'

export default function ShorthandBar() {
  const items = [
    { sym: '?term', desc: 'lookup' },
    { sym: 'line?', desc: 'explain line' },
    { sym: '>action', desc: 'todo' },
    { sym: '*key', desc: 'highlight' },
    { sym: '~approx', desc: 'estimate' },
  ]

  return (
    <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-4 py-1.5 text-[10px] text-[var(--uv-text-muted)]">
      {items.map((it) => (
        <span key={it.sym}>
          <code className="text-[var(--uv-accent-strong)]">{it.sym}</code>
          <span className="ml-1">{it.desc}</span>
        </span>
      ))}
      <span className="ml-auto hidden text-[var(--uv-text-muted)] md:inline">
        ⌘B/I/U · ⌘S export · ⌘K decode · ⌘\ panel
      </span>
    </div>
  )
}
