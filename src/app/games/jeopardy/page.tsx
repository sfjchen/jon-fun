'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { readBoardFromFile } from '@/lib/jeopardy'
import { getRecents, removeRecent, type RecentBoard } from '@/lib/jeopardy-identity'
import { useJeopardyLibrary } from '@/lib/jeopardy-library-client'
import { SAMPLE_BOARD } from '@/lib/jeopardy-sample'

// Magic string that, when typed into the join field, unlocks the saved library.
// Mirrors `DEFAULT_LIBRARY_PASSCODE` server-side; both must match (or both be overridden via env).
const LIBRARY_TRIGGER = '890-'

// Remembers this device's sample board slug so "Play a sample board" reuses it.
const SAMPLE_SLUG_KEY = 'jeopardy_sample_slug'

const surfaceStyle = {
  backgroundColor: 'var(--ink-paper)',
  borderColor: 'var(--ink-border)',
  color: 'var(--ink-text)',
} as const

const sunkStyle = {
  backgroundColor: 'var(--ink-bg)',
  borderColor: 'var(--ink-border)',
  color: 'var(--ink-text)',
} as const

export default function JeopardyPage() {
  const router = useRouter()
  const editFileRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  /* Reads recents from localStorage only after hydration; the version counter re-reads them after a removal. */
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const [, setRecentsVer] = useState(0)
  const recents: RecentBoard[] = hydrated ? getRecents() : []

  const showError = useCallback((msg: string, ttl = 3000) => {
    setError(msg)
    setTimeout(() => setError(null), ttl)
  }, [])

  const library = useJeopardyLibrary(showError)

  /**
   * Creates a board from an optional payload and opens it in edit or play mode.
   * With a reuse key, it reopens the board slug saved under that key while the board still exists,
   * so repeat clicks don't pile up duplicate boards.
   */
  const createBoard = useCallback(
    async (payload?: { board?: unknown; title?: string }, mode: 'edit' | 'play' = 'edit', reuseKey?: string) => {
      setCreating(true)
      try {
        const kept = reuseKey ? localStorage.getItem(reuseKey) : null
        if (kept && (await fetch(`/api/jeopardy/boards/${encodeURIComponent(kept)}`, { cache: 'no-store' })).ok) {
          router.push(`/games/jeopardy/${mode}/${kept}`)
          return
        }
        const res = await fetch('/api/jeopardy/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload ?? {}),
        })
        if (!res.ok) throw new Error('fail')
        const data = await res.json()
        if (reuseKey) localStorage.setItem(reuseKey, data.slug)
        router.push(`/games/jeopardy/${mode}/${data.slug}`)
      } catch {
        showError('Could not create board. Check your connection and try again.', 3500)
      } finally {
        setCreating(false)
      }
    },
    [router, showError],
  )

  const handleJoin = useCallback(() => {
    const raw = joinCode.trim()
    if (raw === LIBRARY_TRIGGER) {
      setJoinCode('')
      void library.unlock(raw)
      return
    }
    const code = raw.toLowerCase()
    if (!/^[a-z0-9-]{3,}$/.test(code)) {
      showError('Enter a valid board code or link')
      return
    }
    const m = code.match(/\/(?:edit|play)\/([a-z0-9-]+)/)
    router.push(`/games/jeopardy/edit/${m?.[1] || code}`)
  }, [joinCode, library, router, showError])

  const handleLibraryOpen = useCallback(
    async (filename: string) => {
      const slug = await library.importEntry(filename)
      if (slug) router.push(`/games/jeopardy/edit/${slug}`)
    },
    [library, router],
  )

  return (
    <div className="flex items-center justify-center p-4">
      {error && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 transform rounded-lg bg-red-600 px-4 py-2 text-white">
          {error}
        </div>
      )}
      <div className="w-full max-w-lg rounded-lg border p-8 shadow-sm" style={surfaceStyle}>
        <h1
          className="mb-2 flex items-center justify-center gap-3 text-center font-lora text-4xl font-bold"
          style={{ color: 'var(--ink-text)' }}
        >
          <Image src="/doodles/notebook/jeopardy.svg" alt="" width={40} height={40} className="h-10 w-10" />
          Jeopardy with Friends
        </h1>
        <p className="mb-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Create a board together in realtime. Share one link — edit from any device.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => void createBoard()}
            disabled={creating}
            className="w-full rounded-lg px-6 py-4 text-xl font-semibold text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            {creating ? 'Creating…' : 'Create New Game'}
          </button>

          <button
            onClick={() =>
              void createBoard({ board: SAMPLE_BOARD, title: SAMPLE_BOARD.title }, 'play', SAMPLE_SLUG_KEY)
            }
            disabled={creating}
            className="w-full rounded-lg border px-6 py-3 hover:opacity-90 disabled:opacity-50"
            style={surfaceStyle}
          >
            Play a sample board
          </button>

          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoin()
              }}
              placeholder="Link or code"
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 outline-none"
              style={sunkStyle}
            />
            <button onClick={handleJoin} className="rounded-lg border px-4 py-2 hover:opacity-90" style={surfaceStyle}>
              Join
            </button>
          </div>

          <button
            onClick={() => editFileRef.current?.click()}
            disabled={creating}
            className="w-full rounded-lg border px-6 py-3 hover:opacity-90 disabled:opacity-50"
            style={surfaceStyle}
          >
            Upload JSON → start collab edit
          </button>
          <input
            ref={editFileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const loaded = await readBoardFromFile(file)
                await createBoard({ board: loaded, title: loaded.title })
              } catch {
                showError('Failed to parse JSON')
              } finally {
                e.target.value = ''
              }
            }}
          />

          {library.items && (
            <div className="mt-6">
              <div
                className="mb-2 flex items-center justify-between text-xs tracking-wide uppercase"
                style={{ color: 'var(--ink-muted)' }}
              >
                <span>📚 Saved library</span>
                <button onClick={library.lock} className="text-xs underline" style={{ color: 'var(--ink-muted)' }}>
                  Lock
                </button>
              </div>
              {library.loading && library.items.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                  Loading…
                </div>
              ) : library.items.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                  No saved boards yet.
                </div>
              ) : (
                <ul className="space-y-1">
                  {library.items.map((item) => {
                    const opening = library.importingFile === item.filename
                    return (
                      <li key={item.filename} className="flex items-center gap-2">
                        <button
                          onClick={() => void handleLibraryOpen(item.filename)}
                          disabled={opening}
                          className="flex-1 truncate rounded-lg border px-3 py-2 text-left hover:opacity-90 disabled:opacity-50"
                          style={sunkStyle}
                          title={`Open ${item.title} in a new collab board`}
                        >
                          <span className="font-semibold">{item.title}</span>
                          <span className="ml-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                            · {item.categories}×{item.rows}
                            {opening ? ' · opening…' : ''}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {recents.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-xs tracking-wide uppercase" style={{ color: 'var(--ink-muted)' }}>
                Recent boards
              </div>
              <ul className="space-y-1">
                {recents.slice(0, 6).map((r) => (
                  <li key={r.slug} className="flex items-center gap-2">
                    <Link
                      href={`/games/jeopardy/edit/${r.slug}`}
                      className="flex-1 truncate rounded-lg border px-3 py-2 hover:opacity-90"
                      style={sunkStyle}
                    >
                      <span className="font-semibold">{r.title}</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                        · {r.slug}
                      </span>
                    </Link>
                    <Link
                      href={`/games/jeopardy/play/${r.slug}`}
                      className="rounded-lg border px-2 py-2 text-sm"
                      style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                      title="Play"
                    >
                      ▶
                    </Link>
                    <button
                      onClick={() => {
                        removeRecent(r.slug)
                        setRecentsVer((v) => v + 1)
                      }}
                      className="rounded-lg border px-2 py-2 text-sm"
                      style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-muted)' }}
                      title="Remove from list"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
