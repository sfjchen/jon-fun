'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConnectionsDifficulty, ConnectionsGroup, ConnectionsPuzzle } from '@/lib/connections'
import {
  CONNECTIONS_DIFFICULTIES,
  CONNECTIONS_DRAFT_KEY,
  createDefaultConnectionsPuzzle,
  downloadConnectionsPuzzle,
  editorChecklist,
  generateConnectionsId,
  getOrCreateConnectionsClientId,
  normalizeWord,
  readPuzzleFromFile,
  slugify,
  validateConnectionsPuzzleShape,
  wordKey,
} from '@/lib/connections'

const TIER_BORDER: Record<ConnectionsDifficulty, string> = {
  yellow: '#d4b84a',
  green: '#6f8f3e',
  blue: '#6b7fd7',
  purple: '#8e4fa3',
}

export type ConnectionsEditorProps = {
  basePath: string
  /** Server puzzle id (UUID) when editing an existing row. */
  editId?: string | null
}

export default function ConnectionsEditor({ basePath, editId = null }: ConnectionsEditorProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [puzzle, setPuzzle] = useState<ConnectionsPuzzle>(() => createDefaultConnectionsPuzzle())
  const [loading, setLoading] = useState(!!editId)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notOwner, setNotOwner] = useState(false)

  const fp = useMemo(() => (typeof window !== 'undefined' ? getOrCreateConnectionsClientId() : ''), [])
  const checklist = useMemo(() => editorChecklist(puzzle), [puzzle])
  const canPublish = checklist.pass

  useEffect(() => {
    if (!editId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadErr(null)
      try {
        const r = await fetch(`/api/connections/puzzles/${encodeURIComponent(editId)}`)
        if (r.status === 503) {
          setLoadErr('Library offline')
          return
        }
        if (!r.ok) throw new Error((await r.json().catch(() => ({})) as { error?: string }).error || r.statusText)
        const p = (await r.json()) as ConnectionsPuzzle
        if (cancelled) return
        setPuzzle(p)
        const local = getOrCreateConnectionsClientId()
        setNotOwner(Boolean(p.authorFingerprint && local && p.authorFingerprint !== local))
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editId])

  // Draft autosave (create only)
  useEffect(() => {
    if (editId) return
    try {
      const t = window.setTimeout(() => {
        localStorage.setItem(CONNECTIONS_DRAFT_KEY, JSON.stringify(puzzle))
      }, 400)
      return () => window.clearTimeout(t)
    } catch {
      return undefined
    }
  }, [puzzle, editId])

  useEffect(() => {
    if (editId) return
    try {
      const raw = localStorage.getItem(CONNECTIONS_DRAFT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as ConnectionsPuzzle
      if (parsed?.id && parsed.groups?.length === 4) setPuzzle(parsed)
    } catch {
      // ignore
    }
  }, [editId])

  const setGroup = useCallback((idx: number, patch: Partial<ConnectionsGroup>) => {
    setPuzzle((p) => {
      const groups = p.groups.map((g, i) => (i === idx ? { ...g, ...patch } : g))
      return { ...p, groups: groups as ConnectionsPuzzle['groups'], updatedAt: new Date().toISOString() }
    })
  }, [])

  const setWord = useCallback((gIdx: number, wIdx: number, value: string) => {
    setPuzzle((p) => {
      const groups = p.groups.map((g, i) => {
        if (i !== gIdx) return g
        const words = [...g.words] as [string, string, string, string]
        words[wIdx] = value
        return { ...g, words }
      })
      return { ...p, groups, updatedAt: new Date().toISOString() }
    })
  }, [])

  const changeTier = useCallback((idx: number, next: ConnectionsDifficulty) => {
    setPuzzle((p) => {
      const groups = p.groups.map((g) => ({ ...g }))
      const row = groups[idx]
      if (!row) return p
      const cur = row.difficulty
      const other = groups.findIndex((g, i) => i !== idx && g.difficulty === next)
      if (other >= 0) {
        const o = groups[other]
        if (o) o.difficulty = cur
      }
      row.difficulty = next
      return { ...p, groups: groups as ConnectionsGroup[], updatedAt: new Date().toISOString() }
    })
  }, [])

  const previewTiles = useMemo(() => {
    const tiles: { word: string; tier: ConnectionsDifficulty }[] = []
    for (const g of puzzle.groups) {
      for (const w of g.words) {
        const nw = normalizeWord(w)
        if (nw) tiles.push({ word: nw, tier: g.difficulty })
      }
    }
    return tiles
  }, [puzzle.groups])

  const publish = useCallback(async () => {
    setSaveErr(null)
    const err = validateConnectionsPuzzleShape(puzzle)
    if (err) {
      setSaveErr(err)
      return
    }
    const authorFingerprint = getOrCreateConnectionsClientId()
    const slug = `${slugify(puzzle.title)}-${puzzle.id.slice(0, 8)}`
    const body: ConnectionsPuzzle = {
      ...puzzle,
      slug,
      authorFingerprint,
      updatedAt: new Date().toISOString(),
    }
    setSaving(true)
    try {
      if (editId) {
        const r = await fetch(`/api/connections/puzzles/${encodeURIComponent(editId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        if (!r.ok) throw new Error(j.error || r.statusText)
        router.push(`${basePath}/play/${encodeURIComponent(slug)}`)
      } else {
        const r = await fetch('/api/connections/puzzles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, createdAt: body.createdAt || new Date().toISOString() }),
        })
        const j = (await r.json().catch(() => ({}))) as { error?: string; slug?: string }
        if (!r.ok) throw new Error(j.error || r.statusText)
        router.push(`${basePath}/play/${encodeURIComponent(j.slug || slug)}`)
      }
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [puzzle, editId, router, basePath])

  const del = useCallback(async () => {
    if (!editId) return
    if (!window.confirm('Delete this puzzle from the library?')) return
    setSaveErr(null)
    setSaving(true)
    try {
      const r = await fetch(`/api/connections/puzzles/${encodeURIComponent(editId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorFingerprint: getOrCreateConnectionsClientId() }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(j.error || r.statusText)
      router.push(basePath)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }, [editId, router, basePath])

  const onImportFile = useCallback(async (f: File | undefined) => {
    if (!f) return
    setSaveErr(null)
    try {
      const p = await readPuzzleFromFile(f)
      setPuzzle((prev) => ({
        ...p,
        id: editId ? prev.id : generateConnectionsId(),
        updatedAt: new Date().toISOString(),
      }))
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Invalid file')
    }
  }, [editId])

  const newBlank = useCallback(() => {
    setPuzzle(createDefaultConnectionsPuzzle())
    try {
      localStorage.removeItem(CONNECTIONS_DRAFT_KEY)
    } catch {
      // ignore
    }
  }, [])

  if (loading) {
    return <p style={{ color: 'var(--ink-muted)' }}>Loading puzzle…</p>
  }
  if (loadErr) {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
        <p className="mb-2">{loadErr}</p>
        <Link href={basePath} className="underline">
          ← Library
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>
          {editId ? 'Edit puzzle' : 'New puzzle'}
        </h1>
        <Link
          href={basePath}
          className="text-sm underline"
          style={{ color: 'var(--ink-accent)' }}
        >
          ← Library
        </Link>
      </div>

      {notOwner && (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          This browser isn&apos;t the original author fingerprint — publishing changes will be blocked. Duplicate via{' '}
          <Link href={`${basePath}/new`} className="underline font-medium">
            New puzzle
          </Link>{' '}
          + import JSON.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span style={{ color: 'var(--ink-muted)' }}>Title</span>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            value={puzzle.title}
            onChange={(e) => setPuzzle((p) => ({ ...p, title: e.target.value, updatedAt: new Date().toISOString() }))}
          />
        </label>
        <label className="block text-sm">
          <span style={{ color: 'var(--ink-muted)' }}>Your name (shown on shelf)</span>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            value={puzzle.authorDisplay}
            onChange={(e) =>
              setPuzzle((p) => ({ ...p, authorDisplay: e.target.value, updatedAt: new Date().toISOString() }))
            }
          />
        </label>
      </div>
      <label className="block text-sm">
        <span style={{ color: 'var(--ink-muted)' }}>Description (optional)</span>
        <textarea
          className="mt-1 w-full rounded-lg border px-3 py-2"
          rows={2}
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
          value={puzzle.description}
          onChange={(e) =>
            setPuzzle((p) => ({ ...p, description: e.target.value, updatedAt: new Date().toISOString() }))
          }
        />
      </label>
      <label className="block text-sm">
        <span style={{ color: 'var(--ink-muted)' }}>Tags (comma-separated)</span>
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
          value={puzzle.tags.join(', ')}
          onChange={(e) =>
            setPuzzle((p) => ({
              ...p,
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              updatedAt: new Date().toISOString(),
            }))
          }
        />
      </label>

      <div
        className="rounded-lg border p-4"
        style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}
      >
        <p className="mb-2 font-medium" style={{ color: 'var(--ink-text)' }}>
          Checklist
        </p>
        <ul className="space-y-1 text-sm">
          {checklist.items.map((it) => (
            <li key={it.id} style={{ color: it.pass ? 'var(--ink-accent)' : 'var(--ink-muted)' }}>
              {it.pass ? '✓' : '○'} {it.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        {puzzle.groups.map((g, gi) => (
          <div
            key={gi}
            className="rounded-lg border-2 p-4"
            style={{ borderColor: TIER_BORDER[g.difficulty] }}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="text-sm flex items-center gap-2">
                <span style={{ color: 'var(--ink-muted)' }}>Tier</span>
                <select
                  value={g.difficulty}
                  onChange={(e) => changeTier(gi, e.target.value as ConnectionsDifficulty)}
                  className="rounded border px-2 py-1"
                  style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                >
                  {CONNECTIONS_DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1 min-w-48 text-sm">
                <span style={{ color: 'var(--ink-muted)' }}>Category</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                  value={g.category}
                  onChange={(e) => setGroup(gi, { category: e.target.value })}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {g.words.map((w, wi) => (
                <input
                  key={wi}
                  className="rounded-lg border px-2 py-2 text-sm"
                  style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                  value={w}
                  placeholder={`Word ${wi + 1}`}
                  onChange={(e) => setWord(gi, wi, e.target.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium" style={{ color: 'var(--ink-text)' }}>
          Live preview (filled tiles)
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {previewTiles.length === 0 ? (
            <p className="text-sm col-span-full" style={{ color: 'var(--ink-muted)' }}>
              Add words to see the grid.
            </p>
          ) : (
            previewTiles.map((t, pi) => (
              <div
                key={`${pi}-${t.tier}-${wordKey(t.word)}`}
                className="rounded-lg border-2 px-2 py-2 text-center text-sm"
                style={{ borderColor: TIER_BORDER[t.tier], color: 'var(--ink-text)' }}
              >
                {t.word}
              </div>
            ))
          )}
        </div>
      </div>

      {saveErr && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{saveErr}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canPublish || saving || notOwner}
          onClick={() => void publish()}
          className="rounded-lg px-4 py-2 text-white disabled:opacity-40"
          style={{ backgroundColor: 'var(--ink-accent)' }}
        >
          {editId ? 'Save changes' : 'Publish to library'}
        </button>
        <button
          type="button"
          onClick={() => downloadConnectionsPuzzle(puzzle)}
          className="rounded-lg border px-4 py-2"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border px-4 py-2"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
        >
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => void onImportFile(e.target.files?.[0])}
        />
        {!editId && (
          <button
            type="button"
            onClick={newBlank}
            className="rounded-lg border px-4 py-2"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
          >
            Clear draft
          </button>
        )}
        {editId && !notOwner && (
          <button
            type="button"
            onClick={() => void del()}
            disabled={saving}
            className="rounded-lg border border-red-400 px-4 py-2 text-red-800 disabled:opacity-40"
            style={{ backgroundColor: 'var(--ink-paper)' }}
          >
            Delete
          </button>
        )}
      </div>

      <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
        Fingerprint on this device: {fp ? `${fp.slice(0, 8)}…` : '(server render)'}
      </p>
    </div>
  )
}
