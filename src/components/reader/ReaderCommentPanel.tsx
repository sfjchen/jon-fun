'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReaderPublicationCommentDto } from '@/lib/reader/comments-server'
import { getReaderCommentIdentity } from '@/lib/reader/comment-identity'

type ReaderCommentPanelProps = {
  open: boolean
  mobile: boolean
  publicationId: string
  chapterId: string
  blockId: string | null
  chapterTitle: string
  comments: ReaderPublicationCommentDto[]
  onClose: () => void
  onPosted: () => void
}

function formatCommentTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ReaderCommentPanel({
  open,
  mobile,
  publicationId,
  chapterId,
  blockId,
  chapterTitle,
  comments,
  onClose,
  onPosted,
}: ReaderCommentPanelProps) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDraft('')
      setError('')
    }
  }, [open, blockId])

  const thread = useMemo(() => {
    if (!blockId) return []
    return comments.filter((c) => c.blockId === blockId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [comments, blockId])

  const submit = useCallback(async () => {
    const text = draft.trim()
    if (!blockId || !text) return
    setBusy(true)
    setError('')
    try {
      const id = getReaderCommentIdentity()
      const res = await fetch('/api/reader/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicationId,
          chapterId,
          blockId,
          body: text,
          authorDisplay: id.displayName || 'Reader',
          authorFingerprint: id.fingerprint,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not post')
        return
      }
      setDraft('')
      onPosted()
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }, [blockId, chapterId, draft, onPosted, publicationId])

  if (!open || !blockId) return null

  const sheet = (
    <aside
      className={
        mobile
          ? 'e-reader-chrome-panel flex max-h-[min(85dvh,calc(100dvh-1rem))] w-full flex-col rounded-t-3xl rounded-b-none border-x-0 border-b-0 border-t p-4 pb-safe shadow-[0_-12px_40px_rgba(15,23,42,0.14)]'
          : 'e-reader-chrome-panel flex max-h-[min(80vh,32rem)] w-full max-w-md flex-col rounded-2xl border p-4 shadow-xl'
      }
      style={{ borderColor: 'var(--ink-border)' }}
      role="dialog"
      aria-modal
      aria-label="Paragraph discussion"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="e-reader-chrome-muted text-xs uppercase tracking-wide">Discussion</p>
          <p className="truncate text-sm font-semibold" title={chapterTitle}>
            {chapterTitle}
          </p>
        </div>
        <button type="button" onClick={onClose} className="e-reader-chrome-chip reader-focus shrink-0 rounded-full px-3 py-1.5 text-sm">
          Close
        </button>
      </div>

      <div className="reader-comment-thread-scroll mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border p-3" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)' }}>
        {thread.length === 0 ? (
          <p className="e-reader-chrome-muted text-sm">No notes here yet. Be the first.</p>
        ) : (
          thread.map((c) => (
            <div key={c.id} className="border-b pb-3 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--ink-border)' }}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0">
                <span className="text-sm font-semibold" style={{ color: 'var(--ink-accent)' }}>
                  {c.authorDisplay}
                </span>
                <time className="e-reader-chrome-muted text-xs" dateTime={c.createdAt}>
                  {formatCommentTime(c.createdAt)}
                </time>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--ink-text)' }}>
                {c.body}
              </p>
            </div>
          ))
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>
          Add a note (visible to anyone with this book on this site)
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Thoughts, questions, highlights…"
          className="e-reader-chrome-input reader-focus w-full resize-none rounded-xl border px-3 py-2 text-sm"
        />
      </label>
      {error ? (
        <p className="mt-2 text-sm" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy || !draft.trim()}
        onClick={() => void submit()}
        className="e-reader-chrome-action reader-focus mt-3 w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
      >
        {busy ? 'Posting…' : 'Post note'}
      </button>
    </aside>
  )

  if (mobile) {
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40 backdrop-blur-[1px]"
        role="presentation"
        onClick={onClose}
      >
        {sheet}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      {sheet}
    </div>
  )
}
