'use client'

import { useMemo, useState } from 'react'
import { deleteDictionaryEntry, loadGlossary, upsertManualEntry } from '@/lib/notes/glossary'
import type { GlossaryEntry } from '@/lib/notes/types'

type DictionaryPanelProps = {
  refreshKey?: number
  noteId: string
  onChange?: () => void
  embedded?: boolean
}

export default function DictionaryPanel({ refreshKey = 0, noteId, onChange, embedded }: DictionaryPanelProps) {
  const entries = useMemo(() => {
    void refreshKey
    return loadGlossary()
  }, [refreshKey])

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draftTerm, setDraftTerm] = useState('')
  const [draftDef, setDraftDef] = useState('')

  function startEdit(entry: GlossaryEntry) {
    setEditingKey(entry.term.toLowerCase())
    setDraftTerm(entry.term)
    setDraftDef(entry.definition)
  }

  function startAdd() {
    setEditingKey('__new__')
    setDraftTerm('')
    setDraftDef('')
  }

  function cancelEdit() {
    setEditingKey(null)
    setDraftTerm('')
    setDraftDef('')
  }

  function saveEdit() {
    const term = draftTerm.trim()
    const def = draftDef.trim()
    if (!term || !def) return
    if (editingKey && editingKey !== '__new__' && editingKey !== term.toLowerCase()) {
      deleteDictionaryEntry(editingKey)
    }
    upsertManualEntry(term, def, noteId)
    cancelEdit()
    onChange?.()
  }

  function remove(term: string) {
    if (!window.confirm(`Delete "${term}" from dictionary?`)) return
    deleteDictionaryEntry(term)
    if (editingKey === term.toLowerCase()) cancelEdit()
    onChange?.()
  }

  return (
    <section
      className={embedded ? 'px-3 pb-2' : 'border-b border-[var(--uv-border)] px-3 py-2'}
      data-testid="notes-glossary-panel"
    >
      <div className="mb-2 flex items-center justify-between">
        {!embedded ? (
          <p className="text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">Dictionary</p>
        ) : (
          <span className="text-[10px] text-[var(--uv-text-muted)]">Term definitions for AI</span>
        )}
        <button
          type="button"
          onClick={startAdd}
          data-testid="notes-dictionary-add"
          className="text-[11px] text-[var(--uv-accent)] hover:underline"
        >
          + Add term
        </button>
      </div>

      {editingKey ? (
        <div className="mb-2 space-y-1.5 rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] p-2">
          <input
            value={draftTerm}
            onChange={(e) => setDraftTerm(e.target.value)}
            placeholder="Term"
            data-testid="notes-dictionary-term-input"
            className="w-full rounded border border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-2 py-1 text-[11px] text-[var(--uv-text-primary)] focus:border-[var(--uv-accent)] focus:outline-none"
          />
          <textarea
            value={draftDef}
            onChange={(e) => setDraftDef(e.target.value)}
            placeholder="Definition"
            rows={3}
            data-testid="notes-dictionary-def-input"
            className="w-full resize-y rounded border border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-2 py-1 text-[11px] text-[var(--uv-text-primary)] focus:border-[var(--uv-accent)] focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              data-testid="notes-dictionary-save"
              className="rounded bg-[var(--uv-accent)] px-2 py-0.5 text-[10px] text-white"
            >
              Save
            </button>
            <button type="button" onClick={cancelEdit} className="text-[10px] text-[var(--uv-text-muted)]">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {entries.length === 0 && !editingKey ? (
        <p className="text-[11px] text-[var(--uv-text-muted)]">
          No terms yet — add manually or ask AI lookup to store definitions.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto" key={refreshKey}>
          {entries.map((e) => (
            <li key={e.term} className="group flex items-start gap-1 rounded px-1 py-0.5 hover:bg-[var(--uv-bg-hover)]">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-medium text-[var(--uv-accent-strong)]">{e.term}</span>
                <p className="whitespace-pre-wrap text-[10px] leading-snug text-[var(--uv-text-secondary)]">
                  {e.definition}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Edit ${e.term}`}
                data-testid={`notes-dictionary-edit-${e.term}`}
                onClick={() => startEdit(e)}
                className="shrink-0 text-[10px] text-[var(--uv-text-muted)] hover:text-[var(--uv-accent)]"
              >
                Edit
              </button>
              <button
                type="button"
                aria-label={`Delete ${e.term}`}
                onClick={() => remove(e.term)}
                className="shrink-0 text-[10px] text-[var(--uv-text-muted)] hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
