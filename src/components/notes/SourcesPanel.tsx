'use client'

import { useMemo } from 'react'
import type { NoteSource } from '@/lib/notes/types'
import { deleteSourceOnServer } from '@/lib/notes/memorySync'
import { isBuiltinSource } from '@/lib/notes/knowledge/builtinSources'
import {
  deleteSourceLocal,
  genSourceId,
  loadSourcesLocal,
  upsertSourceLocal,
} from '@/lib/notes/sources'

type SourcesPanelProps = {
  refreshKey?: number
  onChange?: () => void
}

export default function SourcesPanel({ refreshKey = 0, onChange }: SourcesPanelProps) {
  const sources = useMemo(() => {
    void refreshKey
    return loadSourcesLocal()
  }, [refreshKey])

  function addPaste() {
    const title = window.prompt('Source title')?.trim()
    if (!title) return
    const content = window.prompt('Paste content')?.trim()
    if (!content) return
    const now = new Date().toISOString()
    upsertSourceLocal({
      id: genSourceId(),
      title,
      kind: 'paste',
      content,
      tags: [],
      includeInContext: true,
      createdAt: now,
      updatedAt: now,
    })
    onChange?.()
  }

  return (
    <section className="border-b border-[var(--uv-border)] px-3 py-2" data-testid="notes-sources-panel">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">Sources</p>
        <button
          type="button"
          onClick={addPaste}
          className="text-[11px] text-[var(--uv-accent)] hover:underline"
        >
          + Paste doc
        </button>
      </div>
      {sources.length === 0 ? (
        <p className="text-[11px] text-[var(--uv-text-muted)]">No sources — paste IPS, memos, glossaries.</p>
      ) : (
        <ul className="max-h-32 space-y-1 overflow-y-auto">
          {sources.map((s) => (
            <SourceRow key={s.id} source={s} {...(onChange ? { onChange } : {})} />
          ))}
        </ul>
      )}
    </section>
  )
}

function SourceRow({ source, onChange }: { source: NoteSource; onChange?: () => void }) {
  function toggleInclude() {
    upsertSourceLocal({ ...source, includeInContext: !source.includeInContext, updatedAt: new Date().toISOString() })
    onChange?.()
  }

  function remove() {
    if (isBuiltinSource(source.id)) return
    if (!window.confirm(`Delete "${source.title}"?`)) return
    deleteSourceLocal(source.id)
    void deleteSourceOnServer(source.id)
    onChange?.()
  }

  return (
    <li className="flex items-center gap-1 text-[11px]">
      <button
        type="button"
        onClick={toggleInclude}
        title={source.includeInContext ? 'Included in AI context' : 'Excluded'}
        className={source.includeInContext ? 'text-[var(--uv-accent)]' : 'text-[var(--uv-text-muted)]'}
      >
        {source.includeInContext ? '●' : '○'}
      </button>
      <span className="min-w-0 flex-1 truncate text-[var(--uv-text-secondary)]">{source.title}</span>
      <button type="button" onClick={remove} className="text-[var(--uv-text-muted)] hover:text-red-600">
        ×
      </button>
    </li>
  )
}
