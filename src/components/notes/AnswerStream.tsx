'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEffect, useRef } from 'react'

type AnswerStreamProps = {
  text: string
  isStreaming: boolean
  error?: string | null
}

const mdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--uv-text-secondary)]">
      {children}
    </div>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-1 mt-2 text-xs font-semibold text-[var(--uv-text-primary)]">{children}</div>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-0.5 mt-1.5 text-xs font-medium text-[var(--uv-text-primary)]">{children}</div>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed text-[var(--uv-text-primary)] last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 text-sm text-[var(--uv-text-primary)]">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-sm text-[var(--uv-text-primary)]">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <span className="font-semibold text-[var(--uv-text-primary)]">{children}</span>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-[var(--uv-bg-hover)] px-1 text-[var(--uv-accent-strong)]">{children}</code>
  ),
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
        End a line with <code className="text-[var(--uv-accent-strong)]">?</code> or{' '}
        <code className="text-[var(--uv-accent-strong)]">??</code> — answers appear here.
      </p>
    )
  }

  return (
    <div ref={ref} className="max-h-72 overflow-y-auto text-sm leading-relaxed text-[var(--uv-text-primary)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {text}
      </ReactMarkdown>
      {isStreaming ? <span className="ml-0.5 inline-block animate-pulse text-[var(--uv-accent)]">▌</span> : null}
    </div>
  )
}
