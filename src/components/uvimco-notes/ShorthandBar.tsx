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
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-4 py-1.5 text-[10px] text-[var(--uv-text-secondary)]">
      {items.map((it) => (
        <span key={it.sym}>
          <code className="font-medium text-[var(--uv-accent-strong)]">{it.sym}</code>
          <span className="ml-1">{it.desc}</span>
        </span>
      ))}
      <span className="ml-auto hidden md:inline">
        Ctrl+B/I/U · Ctrl+S export · Ctrl+K decode · Ctrl+\ panel
      </span>
    </div>
  )
}
