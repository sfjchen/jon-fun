'use client'

import type { Lookup } from '@/lib/uvimco-notes/types'
import AnswerStream from './AnswerStream'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

type AIPanelProps = {
  isOpen: boolean
  currentLookup: Lookup | null
  sessionHistory: Lookup[]
  streamText: string
  isStreaming: boolean
  onFollowUp: (q: string) => void
  onSelectHistory: (lookup: Lookup) => void
  onClose: () => void
}

export default function AIPanel({
  isOpen,
  currentLookup,
  sessionHistory,
  streamText,
  isStreaming,
  onFollowUp,
  onSelectHistory,
  onClose,
}: AIPanelProps) {
  if (!isOpen) return null

  return (
    <aside
      className="flex w-[min(100%,300px)] shrink-0 flex-col border-l border-[var(--uv-border)] bg-[var(--uv-bg-panel)] max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:shadow-xl"
      data-testid="uvimco-ai-panel"
    >
      <div className="flex items-center justify-between border-b border-[var(--uv-border)] px-3 py-2">
        <span className="text-xs font-semibold text-[var(--uv-text-secondary)]">AI Lookup</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-[var(--uv-text-muted)] hover:text-[var(--uv-text-primary)]"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {currentLookup ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-[var(--uv-text-secondary)]">
              {currentLookup.type === 'word' ? `?${currentLookup.query}` : `${currentLookup.query}?`}
            </p>
            <AnswerStream text={streamText} isStreaming={isStreaming} />
          </div>
        ) : (
          <AnswerStream text="" isStreaming={false} />
        )}

        {currentLookup && !isStreaming ? (
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const q = String(fd.get('followup') ?? '').trim()
              if (q) {
                onFollowUp(q)
                e.currentTarget.reset()
              }
            }}
          >
            <input
              name="followup"
              placeholder="Ask a follow-up ↵"
              data-testid="uvimco-followup-input"
              className="w-full rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1.5 text-sm text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:border-[var(--uv-accent)] focus:outline-none"
            />
          </form>
        ) : null}

        {sessionHistory.length > 0 ? (
          <div className="mt-6 border-t border-[var(--uv-border)] pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--uv-text-muted)]">
              This meeting
            </p>
            <ul className="space-y-1">
              {sessionHistory.map((lk) => (
                <li key={lk.id}>
                  <button
                    type="button"
                    onClick={() => onSelectHistory(lk)}
                    className="w-full rounded px-2 py-1 text-left text-xs text-[var(--uv-text-secondary)] hover:bg-[var(--uv-accent-dim)] hover:text-[var(--uv-text-primary)]"
                  >
                    {lk.type === 'word' ? `?${lk.query}` : 'line?'} · {timeAgo(lk.triggeredAt)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
