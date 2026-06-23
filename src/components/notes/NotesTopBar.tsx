'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { addToTagCatalog, listKnownTags } from '@/lib/notes/tagRegistry'
import type { NoteSession } from '@/lib/notes/types'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/notes/prefs'

type NotesTopBarProps = {
  title: string
  startedAt: string
  tags: string[]
  sessions: NoteSession[]
  hintsOpen: boolean
  onTitleChange: (title: string) => void
  onTagsChange: (tags: string[]) => void
  onHintsToggle: () => void
}

function formatCreated(iso: string): string {
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
  tags,
  sessions,
  hintsOpen,
  onTitleChange,
  onTagsChange,
  onHintsToggle,
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
      className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-3 py-1.5 sm:px-4"
      data-testid="notes-top-bar"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/"
          className="shrink-0 text-[11px] text-[var(--uv-text-secondary)] hover:text-[var(--uv-accent)]"
          data-testid="notes-home-link"
        >
          ← sfjc.dev
        </Link>
        <span className="shrink-0 text-[11px] font-semibold text-[var(--uv-text-muted)]">Notes</span>
      </div>

      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="min-w-[120px] flex-1 bg-transparent text-base font-semibold text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:outline-none sm:text-lg"
        placeholder="Note title"
        aria-label="Note title"
        data-testid="notes-meeting-title"
      />

      <div
        className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1 sm:max-w-[55%]"
        data-testid="notes-meta-bar"
      >
        <span
          className="hidden text-[10px] text-[var(--uv-text-muted)] xl:inline"
          title={`Created ${formatCreated(startedAt)}`}
          data-testid="notes-created-at"
        >
          {formatCreated(startedAt)}
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
              #{t}
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
        <button
          type="button"
          onClick={onHintsToggle}
          data-testid="notes-shorthand-toggle"
          className="rounded px-1.5 py-0.5 text-[10px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)]"
          aria-expanded={hintsOpen}
        >
          {hintsOpen ? 'Hide hints' : 'Hints'}
        </button>
      </div>
    </header>
  )
}

export function loadHintsOpen(): boolean {
  return loadNotesUiPrefs().shorthandOpen ?? false
}

export function persistHintsOpen(open: boolean): void {
  saveNotesUiPrefs({ shorthandOpen: open })
}
