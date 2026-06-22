'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { searchNotes } from '@/lib/notes/searchIndex'
import type { NoteSession, SearchHit } from '@/lib/notes/types'

type Facet = 'all' | 'body' | 'todo' | 'term' | 'chat'

type GlobalSearchProps = {
  open: boolean
  sessions: NoteSession[]
  onClose: () => void
  onJump: (sessionId: string, lineIndex?: number) => void
}

const facets: { id: Facet; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'body', label: 'Body' },
  { id: 'todo', label: 'Todos' },
  { id: 'term', label: 'Terms' },
  { id: 'chat', label: 'Chats' },
]

export default function GlobalSearch({ open, sessions, onClose, onJump }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [facet, setFacet] = useState<Facet>('all')
  const [hits, setHits] = useState<SearchHit[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setHits([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setHits([])
      return
    }
    setHits(searchNotes(sessions, query, facet))
  }, [query, facet, sessions])

  const handleSelect = useCallback(
    (hit: SearchHit) => {
      onJump(hit.sessionId, hit.lineIndex)
      onClose()
    },
    [onJump, onClose],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      data-testid="notes-global-search"
      onClick={onClose}
    >
      <div
        className="w-[min(560px,92vw)] rounded-lg border border-[var(--uv-border)] bg-[var(--uv-bg-base)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--uv-border)] px-3 py-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, todos, terms…"
            data-testid="notes-search-input"
            className="w-full bg-transparent text-sm text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {facets.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFacet(f.id)}
                className={`rounded px-2 py-0.5 text-[10px] ${
                  facet === f.id
                    ? 'bg-[var(--uv-accent-dim)] text-[var(--uv-accent-strong)]'
                    : 'text-[var(--uv-text-muted)] hover:bg-[var(--uv-bg-hover)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="max-h-64 overflow-y-auto py-1">
          {hits.length === 0 && query.trim() ? (
            <li className="px-3 py-4 text-center text-xs text-[var(--uv-text-muted)]">No results</li>
          ) : null}
          {hits.map((hit, i) => (
            <li key={`${hit.sessionId}-${hit.facet}-${i}`}>
              <button
                type="button"
                data-testid="notes-search-hit"
                onClick={() => handleSelect(hit)}
                className="w-full px-3 py-2 text-left hover:bg-[var(--uv-bg-hover)]"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-[var(--uv-text-primary)]">
                    {hit.sessionTitle}
                  </span>
                  <span className="shrink-0 rounded bg-[var(--uv-bg-hover)] px-1 text-[9px] uppercase text-[var(--uv-text-muted)]">
                    {hit.facet}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--uv-text-secondary)]">{hit.snippet}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
