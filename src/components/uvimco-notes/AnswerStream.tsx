'use client'

import { useEffect, useRef } from 'react'

type AnswerStreamProps = {
  text: string
  isStreaming: boolean
}

export default function AnswerStream({ text, isStreaming }: AnswerStreamProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [text])

  if (!text && !isStreaming) {
    return (
      <p className="text-sm leading-relaxed text-[var(--uv-text-secondary)]">
        Type ?term or end a line with ? — answers appear here.
      </p>
    )
  }

  return (
    <div
      ref={ref}
      className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[var(--uv-text-primary)]"
    >
      {text}
      {isStreaming ? <span className="ml-0.5 inline-block animate-pulse text-[var(--uv-accent)]">▌</span> : null}
    </div>
  )
}
