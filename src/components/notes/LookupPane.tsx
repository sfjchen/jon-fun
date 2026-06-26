'use client'

import type { Lookup } from '@/lib/notes/types'
import { isLookupStreaming, type LookupStreamMap } from '@/lib/notes/lookupStreams'
import LookupConversation from './LookupConversation'
import FollowUpComposer from './FollowUpComposer'

function lookupLabel(lk: Lookup): string {
  if (lk.type === 'section') return `${lk.query}??`
  return `${lk.query}?`
}

type LookupPaneProps = {
  lookup: Lookup
  streamByLookupId: LookupStreamMap
  onFollowUp: (lookupId: string, question: string) => void
  onDismiss: (lookupId: string) => void
  onDelete: (lookupId: string) => void
}

export default function LookupPane({
  lookup,
  streamByLookupId,
  onFollowUp,
  onDismiss,
  onDelete,
}: LookupPaneProps) {
  const stream = streamByLookupId[lookup.id]
  const isStreaming = isLookupStreaming(streamByLookupId, lookup.id)
  const streamText = stream?.text ?? ''
  const error = stream?.error ?? null

  return (
    <div
      className="mb-3 flex min-h-0 flex-col border-b border-[var(--uv-border)] pb-3 last:mb-0 last:border-b-0 last:pb-0"
      data-testid={`notes-lookup-pane-${lookup.id}`}
    >
      <div className="mb-1.5 flex shrink-0 items-center gap-1">
        <p className="min-w-0 flex-1 text-[11px] text-[var(--uv-text-secondary)]">{lookupLabel(lookup)}</p>
        <button
          type="button"
          aria-label="Close this lookup"
          data-testid={`notes-dismiss-lookup-${lookup.id}`}
          onClick={() => onDismiss(lookup.id)}
          className="shrink-0 rounded px-1 text-[10px] text-[var(--uv-text-muted)] hover:text-[var(--uv-text-primary)]"
        >
          Close
        </button>
        <button
          type="button"
          aria-label="Delete this lookup"
          data-testid={`notes-delete-lookup-active-${lookup.id}`}
          onClick={() => onDelete(lookup.id)}
          className="shrink-0 rounded px-1 text-[10px] leading-none text-[var(--uv-text-muted)] hover:text-red-600"
        >
          ×
        </button>
      </div>
      <LookupConversation
        lookup={lookup}
        streamText={streamText}
        isStreaming={isStreaming}
        error={error}
        testId={`notes-chat-thread-${lookup.id}`}
      />
      {!isStreaming ? (
        <FollowUpComposer lookupId={lookup.id} onSubmit={(q) => onFollowUp(lookup.id, q)} />
      ) : null}
    </div>
  )
}
