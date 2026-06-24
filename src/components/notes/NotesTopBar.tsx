'use client'

import { useMemo, useState } from 'react'
import { HomeLink } from '@/components/HomeLink'
import { addToTagCatalog, listKnownTags } from '@/lib/notes/tagRegistry'
import type { NoteSession } from '@/lib/notes/types'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/notes/prefs'

type NotesTopBarProps = {
  title: string
  startedAt: string
  updatedAt: string
  tags: string[]
  sessions: NoteSession[]
  onTitleChange: (title: string) => void
  onTagsChange: (tags: string[]) => void
  onDeleteNote: () => void
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function NotesTopBar({
  title,
  startedAt,
  updatedAt,
  tags,
  sessions,
  onTitleChange,
  onTagsChange,
  onDeleteNote,
}: NotesTopBarProps) {
  const [draft, setDraft] = useState('')
  const knownTags = useMemo(() => listKnownTags(sessions), [sessions])

  function toggleTag(t: string) {
    if (tags.includes(t)) onTagsChange(tags.filter((x) => x !== t))
    else onTagsChange([...tags, t])
  }

  function commitDraft(raw: string) {
    const t = raw.trim().replace(/^#/, '')
    if (!t) return
    addToTagCatalog(t)
    if (!tags.includes(t)) onTagsChange([...tags, t])
    setDraft('')
  }

  return (
    <header
      className="flex min-h-11 shrink-0 items-center gap-x-3 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-3 py-1.5 sm:px-4"
      data-testid="notes-top-bar"
    >
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[var(--uv-text-primary)] placeholder:font-normal placeholder:italic placeholder:text-[var(--uv-text-muted)] focus:outline-none sm:text-lg"
        placeholder="Untitled"
        aria-label="Note title"
        data-testid="notes-meeting-title"
      />

      <button
        type="button"
        onClick={onDeleteNote}
        data-testid="notes-delete-note"
        title="Delete note"
        className="shrink-0 rounded px-2 py-0.5 text-[11px] text-[var(--uv-text-muted)] hover:bg-red-50 hover:text-red-600"
      >
        Delete
      </button>

      <div
        className="hidden min-w-0 flex-wrap items-center justify-end gap-1 sm:flex sm:max-w-[45%]"
        data-testid="notes-meta-bar"
      >
        <span
          className="hidden shrink-0 text-[10px] text-[var(--uv-text-muted)] xl:inline"
          data-testid="notes-dates"
        >
          <span title={`Created ${formatDateTime(startedAt)}`} data-testid="notes-created-at">
            Created {formatDateTime(startedAt)}
          </span>
          <span className="mx-1.5 text-[var(--uv-border)]">·</span>
          <span title={`Last modified ${formatDateTime(updatedAt)}`} data-testid="notes-modified-at">
            Modified {formatDateTime(updatedAt)}
          </span>
        </span>
        {knownTags.map((t) => {
          const on = tags.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              data-testid={`notes-tag-chip-${t}`}
              className={
                on
                  ? 'rounded-full bg-[var(--uv-accent)] px-2 py-0.5 text-[10px] font-medium text-white'
                  : 'rounded-full border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--uv-text-secondary)] hover:border-[var(--uv-accent)]'
              }
            >
              {t}
            </button>
          )
        })}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+ tag ↵"
          data-testid="notes-tag-input"
          className="w-16 min-w-0 bg-transparent text-[10px] text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:w-24 focus:outline-none sm:w-20"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft(draft)
            }
          }}
          onBlur={() => {
            if (draft.trim()) commitDraft(draft)
          }}
        />
      </div>

      <HomeLink variant="notes" className="ml-1 shrink-0" data-testid="notes-home-link" />
    </header>
  )
}

export function loadHintsOpen(): boolean {
  return loadNotesUiPrefs().shorthandOpen ?? false
}

export function persistHintsOpen(open: boolean): void {
  saveNotesUiPrefs({ shorthandOpen: open })
}
