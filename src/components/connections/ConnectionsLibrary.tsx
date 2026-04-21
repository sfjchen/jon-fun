'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConnectionsDifficulty, ConnectionsPuzzleSummary } from '@/lib/connections'
import { CONNECTIONS_DIFFICULTIES, summaryAvgMistakes, summarySolveRate } from '@/lib/connections'

const TIER_DOT: Record<ConnectionsDifficulty, string> = {
  yellow: '#f9df6d',
  green: '#a0c35a',
  blue: '#b0c4ef',
  purple: '#ba81c5',
}

export type ConnectionsLibraryProps = {
  basePath: string
}

type SortKey = 'newest' | 'plays' | 'solve_rate'

export default function ConnectionsLibrary({ basePath }: ConnectionsLibraryProps) {
  const [items, setItems] = useState<ConnectionsPuzzleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/connections/puzzles?sort=newest&limit=300')
      if (r.status === 503) {
        setOffline(true)
        setItems([])
        return
      }
      setOffline(false)
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || r.statusText)
      }
      const data = (await r.json()) as ConnectionsPuzzleSummary[]
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = items
    if (q) {
      list = list.filter((it) => {
        const hay = `${it.title} ${it.description} ${(it.tags || []).join(' ')}`.toLowerCase()
        return hay.includes(q)
      })
    }
    const sorted = [...list]
    if (sort === 'newest') {
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } else if (sort === 'plays') {
      sorted.sort((a, b) => b.playCount - a.playCount || b.updatedAt.localeCompare(a.updatedAt))
    } else {
      sorted.sort((a, b) => {
        const ra = a.playCount > 0 ? a.solveCount / a.playCount : 0
        const rb = b.playCount > 0 ? b.solveCount / b.playCount : 0
        return rb - ra || b.playCount - a.playCount
      })
    }
    return sorted
  }, [items, search, sort])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-lora text-3xl font-semibold" style={{ color: 'var(--ink-text)' }}>
            Connections (community)
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Play puzzles from the shelf or publish your own (four groups × four words).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${basePath}/new`}
            className="rounded-lg px-4 py-2 text-white hover:opacity-95"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Create puzzle
          </Link>
        </div>
      </div>

      {offline && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          Library is offline (Supabase not configured). You can still use{' '}
          <Link href={`${basePath}/new`} className="underline font-medium">
            Create puzzle
          </Link>{' '}
          and export JSON locally.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search title, description, tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm sm:max-w-md"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        />
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border px-2 py-2"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
          >
            <option value="newest">Newest</option>
            <option value="plays">Most played</option>
            <option value="solve_rate">Highest solve rate</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-muted)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-lg border p-8 text-center"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <p className="font-lora text-lg mb-2" style={{ color: 'var(--ink-text)' }}>
            No puzzles yet
          </p>
          <p className="mb-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Be the first to publish one to the public shelf.
          </p>
          <Link
            href={`${basePath}/new`}
            className="inline-block rounded-lg px-4 py-2 text-white"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Create puzzle
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {filtered.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border p-4 shadow-sm transition-opacity hover:opacity-95"
              style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-lora text-lg font-semibold leading-tight" style={{ color: 'var(--ink-text)' }}>
                  {it.title}
                </h2>
                <div className="flex shrink-0 gap-0.5" title="Difficulty tiers (yellow → purple)">
                  {CONNECTIONS_DIFFICULTIES.map((d) => (
                    <span
                      key={d}
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: TIER_DOT[d] }}
                    />
                  ))}
                </div>
              </div>
              {it.description ? (
                <p className="mb-2 line-clamp-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                  {it.description}
                </p>
              ) : null}
              <p className="mb-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                by {it.authorDisplay || 'Anonymous'} · {it.playCount} plays · {summarySolveRate(it.solveCount, it.playCount)}%
                solved · avg {summaryAvgMistakes(it.totalMistakes, it.playCount)} mistakes
              </p>
              {it.tags?.length ? (
                <p className="mb-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
                  {it.tags.map((t) => (
                    <span key={t} className="mr-2 rounded bg-[var(--ink-bg)] px-1.5 py-0.5">
                      {t}
                    </span>
                  ))}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`${basePath}/play/${it.slug}`}
                  className="rounded-lg px-3 py-1.5 text-sm text-white"
                  style={{ backgroundColor: 'var(--ink-accent)' }}
                >
                  Play
                </Link>
                <Link
                  href={`${basePath}/edit/${it.id}`}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
