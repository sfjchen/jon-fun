'use client'

import { useMemo, useRef, useState } from 'react'
import type { NoteSession, NoteSource } from '@/lib/notes/types'
import { deleteSourceOnServer, pushSourcesToServer } from '@/lib/notes/memorySync'
import { buildBuiltinSources, isBuiltinSource } from '@/lib/notes/knowledge/builtinSources'
import { isSourceEnabledForNote } from '@/lib/notes/sourceSelection'
import {
  deleteSourceLocal,
  genSourceId,
  loadSourcesLocal,
  readSourceFile,
  upsertSourceLocal,
} from '@/lib/notes/sources'
import { NotesRowAction } from './NotesActionUi'

type SourcesPanelProps = {
  refreshKey?: number
  session: NoteSession
  splitSession?: NoteSession | null
  onToggleSourceForNote: (sourceId: string, enabled: boolean, sessionId?: string) => void
  onChange?: () => void
  embedded?: boolean
}

export default function SourcesPanel({
  refreshKey = 0,
  session,
  splitSession = null,
  onToggleSourceForNote,
  onChange,
  embedded,
}: SourcesPanelProps) {
  const sources = useMemo(() => {
    void refreshKey
    return loadSourcesLocal()
  }, [refreshKey])

  const fileRef = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')

  function syncLibrary() {
    onChange?.()
    void pushSourcesToServer()
  }

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
    syncLibrary()
  }

  async function onFileSelected(file: File | undefined) {
    if (!file) return
    try {
      const { title, content } = await readSourceFile(file)
      if (!content.trim()) {
        window.alert('File is empty or could not be read as text.')
        return
      }
      const now = new Date().toISOString()
      upsertSourceLocal({
        id: genSourceId(),
        title,
        kind: 'upload',
        content,
        tags: [],
        includeInContext: true,
        createdAt: now,
        updatedAt: now,
      })
      syncLibrary()
    } catch {
      window.alert('Could not read file.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function startEdit(source: NoteSource) {
    setEditingId(source.id)
    setDraftTitle(source.title)
    setDraftContent(source.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraftTitle('')
    setDraftContent('')
  }

  function saveEdit(source: NoteSource) {
    const title = draftTitle.trim()
    const content = draftContent.trim()
    if (!title || !content) return
    upsertSourceLocal({
      ...source,
      title,
      content,
      userEdited: true,
      updatedAt: new Date().toISOString(),
    })
    cancelEdit()
    syncLibrary()
  }

  function resetPack(source: NoteSource) {
    if (!isBuiltinSource(source.id)) return
    const fresh = buildBuiltinSources().find((s) => s.id === source.id)
    if (!fresh) return
    upsertSourceLocal({ ...fresh, includeInContext: source.includeInContext })
    cancelEdit()
    syncLibrary()
  }

  function removeSource(source: NoteSource) {
    if (isBuiltinSource(source.id)) return
    deleteSourceLocal(source.id)
    void deleteSourceOnServer(source.id)
    if (editingId === source.id) cancelEdit()
    syncLibrary()
  }

  const editing = editingId ? sources.find((s) => s.id === editingId) : null

  return (
    <section
      className={embedded ? 'px-3 pb-2' : 'border-b border-[var(--uv-border)] px-3 py-2'}
      data-testid="notes-sources-panel"
    >
      <div className={`mb-2 flex flex-wrap items-center gap-1 ${embedded ? 'justify-end' : 'justify-between'}`}>
        {!embedded ? (
          <p className="text-[10px] uppercase tracking-wide text-[var(--uv-text-muted)]">Sources</p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addPaste}
            data-testid="notes-sources-paste"
            className="text-[11px] text-[var(--uv-accent)] hover:underline"
          >
            + Paste
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            data-testid="notes-sources-attach"
            className="text-[11px] text-[var(--uv-accent)] hover:underline"
          >
            + Attach file
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            data-testid="notes-sources-file-input"
            accept=".txt,.md,.markdown,.csv,.json,.html,.xml,.tsv,text/plain,text/markdown,text/csv,text/html,application/json"
            onChange={(e) => void onFileSelected(e.target.files?.[0])}
          />
        </div>
      </div>

      {editing ? (
        <div
          className="mb-2 rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] p-2"
          data-testid="notes-source-editor"
        >
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            data-testid="notes-source-title-input"
            placeholder="Title"
            className="mb-2 w-full rounded border border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-2 py-1 text-sm text-[var(--uv-text-primary)]"
          />
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            data-testid="notes-source-content-input"
            rows={8}
            placeholder="Content"
            className="mb-2 w-full resize-y rounded border border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-2 py-1 font-mono text-sm leading-relaxed text-[var(--uv-text-primary)]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveEdit(editing)}
              data-testid="notes-source-save"
              className="rounded bg-[var(--uv-accent-dim)] px-2 py-0.5 text-[10px] text-[var(--uv-text-primary)]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded px-2 py-0.5 text-[10px] text-[var(--uv-text-muted)] hover:text-[var(--uv-text-primary)]"
            >
              Cancel
            </button>
            {isBuiltinSource(editing.id) ? (
              <button
                type="button"
                onClick={() => resetPack(editing)}
                data-testid="notes-source-reset-pack"
                className="rounded px-2 py-0.5 text-[10px] text-[var(--uv-text-muted)] hover:text-[var(--uv-text-primary)]"
              >
                Reset pack
              </button>
            ) : (
              <button
                type="button"
                onClick={() => removeSource(editing)}
                data-testid="notes-source-delete"
                className="rounded px-2 py-0.5 text-[10px] text-red-600 hover:underline"
              >
                Delete source
              </button>
            )}
          </div>
        </div>
      ) : null}

      {sources.length === 0 ? (
        <p className="text-[11px] text-[var(--uv-text-muted)]">No sources — paste or attach IPS, memos, glossaries.</p>
      ) : splitSession ? (
        <div className="space-y-2">
          <SourceList
            label={session.title.trim() || 'Left note'}
            sources={sources}
            session={session}
            onToggleSourceForNote={onToggleSourceForNote}
            onEdit={startEdit}
            onDelete={removeSource}
          />
          <SourceList
            label={splitSession.title.trim() || 'Right note'}
            sources={sources}
            session={splitSession}
            onToggleSourceForNote={onToggleSourceForNote}
            onEdit={startEdit}
            onDelete={removeSource}
          />
        </div>
      ) : (
        <SourceList
          sources={sources}
          session={session}
          onToggleSourceForNote={onToggleSourceForNote}
          onEdit={startEdit}
          onDelete={removeSource}
        />
      )}
    </section>
  )
}

function SourceList({
  label,
  sources,
  session,
  onToggleSourceForNote,
  onEdit,
  onDelete,
}: {
  label?: string
  sources: NoteSource[]
  session: NoteSession
  onToggleSourceForNote: (sourceId: string, enabled: boolean, sessionId?: string) => void
  onEdit: (source: NoteSource) => void
  onDelete: (source: NoteSource) => void
}) {
  return (
    <div>
      {label ? (
        <p className="mb-1 truncate text-[10px] font-medium text-[var(--uv-text-secondary)]">{label}</p>
      ) : null}
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {sources.map((s) => (
          <SourceRow
            key={`${session.id}-${s.id}`}
            source={s}
            enabled={isSourceEnabledForNote(session, s.id)}
            onToggle={(enabled) => onToggleSourceForNote(s.id, enabled, session.id)}
            onEdit={() => onEdit(s)}
            {...(!isBuiltinSource(s.id) ? { onDelete: () => onDelete(s) } : {})}
          />
        ))}
      </ul>
    </div>
  )
}

function SourceRow({
  source,
  enabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  source: NoteSource
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onEdit: () => void
  onDelete?: () => void
}) {
  return (
    <li className="group flex items-center gap-1.5 text-[11px]">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
        data-testid={`notes-source-check-${source.id}`}
        aria-label={`Include ${source.title} for this note`}
        className="shrink-0 accent-[var(--uv-accent)]"
      />
      <button
        type="button"
        onClick={onEdit}
        data-testid={`notes-source-open-${source.id}`}
        className={`min-w-0 flex-1 truncate text-left hover:underline ${
          enabled ? 'text-[var(--uv-text-primary)]' : 'text-[var(--uv-text-muted)]'
        }`}
      >
        {source.title}
        {source.userEdited ? <span className="ml-1 text-[9px] text-[var(--uv-text-muted)]">(edited)</span> : null}
      </button>
      {onDelete ? (
        <NotesRowAction
          label={`Delete ${source.title}`}
          testId={`notes-source-delete-row-${source.id}`}
          onClick={onDelete}
        />
      ) : null}
      <span className="shrink-0 text-[9px] uppercase text-[var(--uv-text-muted)]">{source.kind}</span>
    </li>
  )
}
