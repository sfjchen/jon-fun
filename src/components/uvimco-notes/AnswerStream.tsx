'use client'

import { useEffect, useRef } from 'react'

type AnswerStreamProps = {
  text: string
  isStreaming: boolean
  error?: string | null
}

export default function AnswerStream({ text, isStreaming, error }: AnswerStreamProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [text])

  if (error) {
    return <p className="text-sm text-amber-900">{error}</p>
  }

  if (!text && !isStreaming) {
    return (
      <p className="text-sm leading-relaxed text-[var(--uv-text-secondary)]">
        Type <code className="text-[var(--uv-accent-strong)]">?term</code> or end a line with{' '}
        <code className="text-[var(--uv-accent-strong)]">?</code> — answers appear here.
      </p>
    )
  }

  return (
    <div
      ref={ref}
      className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[var(--uv-text-primary)]"
    >
      {text}
      {isStreaming ? <span className="ml-0.5 inline-block animate-pulse text-[var(--uv-accent)]">▌</span> : null}
    </div>
  )
}
