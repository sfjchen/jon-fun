'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { ConnectionsPuzzle } from '@/lib/connections'
import { buildShareLines } from '@/lib/connections'
import ConnectionsBoard, { type ConnectionsCompletePayload } from '@/components/connections/ConnectionsBoard'
import ConnectionsResult from '@/components/connections/ConnectionsResult'
import { dailyScore } from '@/lib/connections-daily'
import type { ConnectionsProgress } from '@/lib/connections'
import { logResult, markPracticeIfFuture, isPracticeResult } from '@/lib/results'
import { SAMPLE_PUZZLE } from '@/lib/connections-sample'

export type ConnectionsPlayProps = {
  basePath: string
  idOrSlug: string
  initialPuzzle?: ConnectionsPuzzle
  dailyDay?: string
}

export default function ConnectionsPlay({ basePath, idOrSlug, initialPuzzle, dailyDay }: ConnectionsPlayProps) {
  const [puzzle, setPuzzle] = useState<ConnectionsPuzzle | null>(initialPuzzle ?? null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initialPuzzle)
  const [result, setResult] = useState<ConnectionsCompletePayload | null>(null)
  const [runId, setRunId] = useState(0)
  const progressKey = `connections:v2:${dailyDay ?? 'archive'}:${idOrSlug}`
  const [initialProgress] = useState<ConnectionsProgress | undefined>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey) ?? 'null') as ConnectionsProgress | null
      if (saved && Array.isArray(saved.guesses) && saved.guesses.every(g => Array.isArray(g) && g.length === 4 && g.every(w => typeof w === 'string'))) return saved
    } catch {}
    return undefined
  })
  const saveProgress = useCallback((progress: ConnectionsProgress) => {
    markPracticeIfFuture('connections', dailyDay)
    try { localStorage.setItem(progressKey, JSON.stringify(progress)) } catch {}
  }, [progressKey, dailyDay])

  useEffect(() => {
    if (initialPuzzle) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        if (idOrSlug === SAMPLE_PUZZLE.slug) {
          if (!cancelled) setPuzzle(SAMPLE_PUZZLE)
          return
        }
        if (/^nyt-archive-\d{4}-\d{2}-\d{2}$/.test(idOrSlug)) {
          const year = idOrSlug.slice(12, 16)
          const response = await fetch(`/puzzle-archives/connections/${year}.json`)
          if (!response.ok) throw new Error('Archive unavailable')
          const archive = await response.json() as ConnectionsPuzzle[]
          const found = archive.find((p) => p.slug === idOrSlug)
          if (!found) throw new Error('Puzzle not found')
          if (!cancelled) setPuzzle(found)
          return
        }
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
  }, [idOrSlug, initialPuzzle])

  useEffect(() => {
    if (!result || !puzzle || puzzle === SAMPLE_PUZZLE || puzzle.id.startsWith('nyt-archive-')) return
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
    if (dailyDay) logResult('connections', dailyScore(p.won, p.wrongGuesses, p.solvedDifficulties.length), undefined, dailyDay, { solved: p.won, mistakes: p.wrongGuesses, n: p.solvedDifficulties.length, puzzleId: idOrSlug })
  }, [dailyDay, idOrSlug])

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
      {dailyDay && isPracticeResult('connections', dailyDay) && <p className="text-sm">Future preview · this run stays unranked.</p>}
      {puzzle.difficultyKnown === false && <p className="text-xs text-[var(--ink-muted)]">Original difficulty colors are unavailable for this puzzle; all groups use a neutral color.</p>}
      <ConnectionsBoard key={`${puzzle.id}-${runId}`} puzzle={puzzle} initialProgress={runId === 0 ? initialProgress : undefined} onProgress={saveProgress} onComplete={onComplete} />
      {result && (
        <ConnectionsResult
          title={puzzle.title}
          won={result.won}
          wrongGuesses={result.wrongGuesses}
          shareLines={buildShareLines(new Set(result.solvedDifficulties), result.won)}
          basePath={basePath}
          {...(dailyDay ? {} : { onReplay: replay })}
        />
      )}
    </div>
  )
}
