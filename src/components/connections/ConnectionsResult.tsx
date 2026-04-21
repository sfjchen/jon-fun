'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'

export type ConnectionsResultProps = {
  title: string
  won: boolean
  wrongGuesses: number
  shareLines: string[]
  basePath: string
  onReplay: () => void
}

export default function ConnectionsResult({
  title,
  won,
  wrongGuesses,
  shareLines,
  basePath,
  onReplay,
}: ConnectionsResultProps) {
  const [copied, setCopied] = useState(false)

  const shareText = [
    `sfjc.dev — Connections`,
    title,
    won ? 'Solved!' : `Out (${wrongGuesses} wrong)`,
    ...shareLines,
  ].join('\n')

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [shareText])

  return (
    <div
      className="mx-auto w-full max-w-lg rounded-lg border p-6 shadow-sm"
      style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
    >
      <h2 className="font-lora text-2xl font-semibold mb-2" style={{ color: 'var(--ink-text)' }}>
        {won ? 'Nice!' : 'Nice try'}
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
        {title} — {wrongGuesses} wrong {wrongGuesses === 1 ? 'guess' : 'guesses'}
      </p>
      <pre
        className="mb-4 rounded-md border p-3 font-mono text-sm whitespace-pre-wrap"
        style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
      >
        {shareText}
      </pre>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg px-4 py-2 text-white hover:opacity-95"
          style={{ backgroundColor: 'var(--ink-accent)' }}
        >
          {copied ? 'Copied' : 'Copy share text'}
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="rounded-lg border px-4 py-2 hover:opacity-90"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          Play again
        </button>
        <Link
          href={basePath}
          className="inline-flex items-center rounded-lg border px-4 py-2 hover:opacity-90"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          Library
        </Link>
      </div>
    </div>
  )
}
