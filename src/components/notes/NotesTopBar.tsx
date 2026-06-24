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
      className="flex shrink-0 flex-col border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)]"
      data-testid="notes-top-bar"
    >
      <div className="flex min-h-11 items-center gap-x-3 px-3 py-1.5 sm:px-4">
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

        <HomeLink variant="notes" className="ml-1 shrink-0" data-testid="notes-home-link" />
      </div>

      <div
        className="notes-tag-row-mobile flex gap-1 overflow-x-auto px-3 pb-2 sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-4"
        data-testid="notes-tag-row"
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
        <TagChips tags={tags} knownTags={knownTags} toggleTag={toggleTag} />
        <TagInput draft={draft} setDraft={setDraft} commitDraft={commitDraft} />
      </div>
    </header>
  )
}

function TagChips({
  tags,
  knownTags,
  toggleTag,
}: {
  tags: string[]
  knownTags: string[]
  toggleTag: (t: string) => void
}) {
  return (
    <>
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
                ? 'shrink-0 rounded-full bg-[var(--uv-accent)] px-2 py-0.5 text-[10px] font-medium text-white'
                : 'shrink-0 rounded-full border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--uv-text-secondary)] hover:border-[var(--uv-accent)]'
            }
          >
            {t}
          </button>
        )
      })}
    </>
  )
}

function TagInput({
  draft,
  setDraft,
  commitDraft,
}: {
  draft: string
  setDraft: (v: string) => void
  commitDraft: (raw: string) => void
}) {
  return (
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
  )
}

export function loadHintsOpen(): boolean {
  return loadNotesUiPrefs().shorthandOpen ?? false
}

export function persistHintsOpen(open: boolean): void {
  saveNotesUiPrefs({ shorthandOpen: open })
}
