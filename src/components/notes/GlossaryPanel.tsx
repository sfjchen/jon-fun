'use client'

import { useMemo } from 'react'
import { loadGlossary } from '@/lib/notes/glossary'

type GlossaryPanelProps = {
  refreshKey?: number
  /** When true, omit section header (parent CollapsibleSection provides it). */
  embedded?: boolean
}

export default function GlossaryPanel({ refreshKey = 0, embedded }: GlossaryPanelProps) {
  const entries = useMemo(() => {
    void refreshKey
    return loadGlossary().slice(0, 12)
  }, [refreshKey])

  return (
    <section
      className={embedded ? 'px-3 pb-2' : 'border-b border-[var(--uv-border)] px-3 py-2'}
      data-testid="notes-glossary-panel"
      key={refreshKey}
    >
      {!embedded ? (
        <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">Glossary</p>
      ) : null}
      {entries.length === 0 ? (
        <p className="text-[11px] text-[var(--uv-text-muted)]">Terms auto-collected from AI lookups.</p>
      ) : (
        <ul className="max-h-36 space-y-1.5 overflow-y-auto" key={refreshKey}>
          {entries.map((e) => (
            <li key={e.term}>
              <span className="text-[11px] font-medium text-[var(--uv-accent-strong)]">{e.term}</span>
              <p className="line-clamp-2 text-[10px] text-[var(--uv-text-secondary)]">{e.definition}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
