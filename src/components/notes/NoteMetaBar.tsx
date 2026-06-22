'use client'

import { listDomains } from '@/lib/notes/knowledge/registry'
import type { KnowledgeDomainId } from '@/lib/notes/knowledge/registry'
import type { NoteKind, NoteMetadata } from '@/lib/notes/types'

type NoteMetaBarProps = {
  tags: string[]
  metadata?: NoteMetadata
  onTagsChange: (tags: string[]) => void
  onMetadataChange: (metadata: NoteMetadata) => void
}

const kindOptions: { value: NoteKind | ''; label: string }[] = [
  { value: '', label: 'Kind' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'learning', label: 'Learning' },
  { value: 'IC', label: 'IC' },
  { value: 'GP', label: 'GP' },
  { value: 'internal', label: 'Internal' },
  { value: 'other', label: 'Other' },
]

export default function NoteMetaBar({ tags, metadata, onTagsChange, onMetadataChange }: NoteMetaBarProps) {
  const meetingAt = metadata?.meetingAt ?? ''
  const domains = listDomains()

  function addTag(raw: string) {
    const t = raw.trim().replace(/^#/, '')
    if (!t || tags.includes(t)) return
    onTagsChange([...tags, t])
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-[var(--uv-border)] px-5 py-2 sm:px-6"
      data-testid="notes-meta-bar"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-0.5 rounded-full bg-[var(--uv-accent-dim)] px-2 py-0.5 text-[11px] text-[var(--uv-accent-strong)]"
          >
            #{t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={() => onTagsChange(tags.filter((x) => x !== t))}
              className="text-[var(--uv-text-muted)] hover:text-[var(--uv-text-primary)]"
            >
              ×
            </button>
          </span>
        ))}
        <input
          placeholder="Add tag ↵"
          data-testid="notes-tag-input"
          className="min-w-[80px] flex-1 bg-transparent text-[11px] text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(e.currentTarget.value)
              e.currentTarget.value = ''
            }
          }}
        />
      </div>
      <select
        value={metadata?.domain ?? ''}
        onChange={(e) => {
          const val = e.target.value as KnowledgeDomainId | ''
          const next: NoteMetadata = { ...metadata }
          if (val) next.domain = val
          else delete next.domain
          onMetadataChange(next)
        }}
        data-testid="notes-domain-select"
        className="max-w-[140px] rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-0.5 text-[11px]"
        title="AI knowledge domain (auto if blank)"
      >
        <option value="">Domain (auto)</option>
        {domains.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
      <input
        type="datetime-local"
        value={meetingAt ? meetingAt.slice(0, 16) : ''}
        onChange={(e) => {
          const v = e.target.value
          const next: NoteMetadata = { ...metadata }
          if (v) next.meetingAt = new Date(v).toISOString()
          onMetadataChange(next)
        }}
        data-testid="notes-meeting-datetime"
        className="rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-0.5 text-[11px]"
        title="Meeting date/time"
      />
      <select
        value={metadata?.kind ?? ''}
        onChange={(e) => {
          const val = e.target.value as NoteKind | ''
          const next: NoteMetadata = { ...metadata }
          if (val) next.kind = val
          else delete next.kind
          onMetadataChange(next)
        }}
        data-testid="notes-kind-select"
        className="rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-0.5 text-[11px]"
      >
        {kindOptions.map((o) => (
          <option key={o.value || 'none'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
