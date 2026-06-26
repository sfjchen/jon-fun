'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { useEffect, useRef } from 'react'
import type { Lookup, Message } from '@/lib/notes/types'
import 'katex/dist/katex.min.css'

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

function AssistantBubble({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="mb-3 text-sm leading-relaxed text-[var(--uv-text-primary)]" data-testid="notes-chat-assistant">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={mdComponents}
      >
        {content}
      </ReactMarkdown>
      {streaming ? <span className="ml-0.5 inline-block animate-pulse text-[var(--uv-accent)]">▌</span> : null}
    </div>
  )
}

function UserBubble({ content }: { content: string }) {
  return (
    <div
      className="mb-2 ml-4 rounded-lg border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--uv-text-secondary)]"
      data-testid="notes-chat-user"
    >
      {content}
    </div>
  )
}

type LookupConversationProps = {
  lookup: Lookup | null
  streamText: string
  isStreaming: boolean
  error?: string | null
  testId?: string
}

export default function LookupConversation({
  lookup,
  streamText,
  isStreaming,
  error,
  testId = 'notes-chat-thread',
}: LookupConversationProps) {
  const ref = useRef<HTMLDivElement>(null)
  const messages = lookup?.conversation ?? []

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, streamText, isStreaming])

  if (error) {
    return <p className="text-sm text-amber-900">{error}</p>
  }

  const empty = messages.length === 0 && !isStreaming && !streamText
  if (empty) return null

  return (
    <div
      ref={ref}
      className="max-h-[min(50vh,28rem)] min-h-[4rem] overflow-y-auto"
      data-testid={testId}
    >
      {messages.map((m: Message, i) =>
        m.role === 'user' ? (
          <UserBubble key={`u-${i}`} content={m.content} />
        ) : (
          <AssistantBubble key={`a-${i}`} content={m.content} />
        ),
      )}
      {isStreaming ? <AssistantBubble content={streamText} streaming /> : null}
    </div>
  )
}
