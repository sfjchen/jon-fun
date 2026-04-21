'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { ConnectionsPuzzle } from '@/lib/connections'
import { buildShareLines } from '@/lib/connections'
import ConnectionsBoard, { type ConnectionsCompletePayload } from '@/components/connections/ConnectionsBoard'
import ConnectionsResult from '@/components/connections/ConnectionsResult'

export type ConnectionsPlayProps = {
  basePath: string
  idOrSlug: string
}

export default function ConnectionsPlay({ basePath, idOrSlug }: ConnectionsPlayProps) {
  const [puzzle, setPuzzle] = useState<ConnectionsPuzzle | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ConnectionsCompletePayload | null>(null)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await fetch(`/api/connections/puzzles/${encodeURIComponent(idOrSlug)}`)
        if (r.status === 503) {
          if (!cancelled) setErr('Library offline — configure Supabase for this deployment.')
          return
        }
        if (!cancelled && !r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          setErr(j.error || r.statusText)
          return
        }
        const p = (await r.json()) as ConnectionsPuzzle
        if (!cancelled) setPuzzle(p)
      } catch {
        if (!cancelled) setErr('Failed to load puzzle')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idOrSlug])

  useEffect(() => {
    if (!result || !puzzle) return
    void (async () => {
      try {
        await fetch(`/api/connections/puzzles/${encodeURIComponent(puzzle.id)}/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ solved: result.won, mistakes: result.wrongGuesses }),
        })
      } catch {
        // non-blocking
      }
    })()
  }, [result, puzzle])

  const onComplete = useCallback((p: ConnectionsCompletePayload) => {
    setResult(p)
  }, [])

  const replay = useCallback(() => {
    setResult(null)
    setRunId((x) => x + 1)
  }, [])

  if (loading) {
    return (
      <p data-testid="connections-play-loading" style={{ color: 'var(--ink-muted)' }}>
        Loading puzzle…
      </p>
    )
  }
  if (err || !puzzle) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <p style={{ color: 'var(--ink-text)' }}>{err || 'Not found'}</p>
        <Link href={basePath} className="underline" style={{ color: 'var(--ink-accent)' }}>
          ← Library
        </Link>
      </div>
    )
  }

  if (result) {
    const shareLines = buildShareLines(new Set(result.solvedDifficulties), result.won)
    return (
      <div className="mx-auto w-full max-w-xl space-y-6">
        <ConnectionsResult
          title={puzzle.title}
          won={result.won}
          wrongGuesses={result.wrongGuesses}
          shareLines={shareLines}
          basePath={basePath}
          onReplay={replay}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-lora text-xl font-semibold" style={{ color: 'var(--ink-text)' }}>
          {puzzle.title}
        </h1>
        <Link href={basePath} className="text-sm underline" style={{ color: 'var(--ink-accent)' }}>
          Library
        </Link>
      </div>
      <ConnectionsBoard key={`${puzzle.id}-${runId}`} puzzle={puzzle} onComplete={onComplete} />
    </div>
  )
}
