'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { readBoardFromFile } from '@/lib/jeopardy'
import { getOrCreateIdentity, getRecents, removeRecent, type RecentBoard } from '@/lib/jeopardy-identity'

const LIBRARY_PASSCODE_KEY = 'jeopardy:library-passcode'
// Magic string that, when typed into the join field, unlocks the saved library.
// Mirrors `DEFAULT_LIBRARY_PASSCODE` server-side; both must match (or both be overridden via env).
const LIBRARY_TRIGGER = '890-'

interface LibraryEntry {
  filename: string
  title: string
  categories: number
  rows: number
}

export default function JeopardyPage() {
  const router = useRouter()
  const isNotebook = true
  const editFileRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [recents, setRecents] = useState<RecentBoard[]>([])
  const [libraryPasscode, setLibraryPasscode] = useState('')
  const [libraryItems, setLibraryItems] = useState<LibraryEntry[] | null>(null)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [importingFile, setImportingFile] = useState<string | null>(null)

  useEffect(() => {
    setRecents(getRecents())
    const stored = typeof window !== 'undefined' ? localStorage.getItem(LIBRARY_PASSCODE_KEY) : null
    if (stored) {
      setLibraryPasscode(stored)
      void unlockLibrary(stored)
    }
  }, [])

  async function unlockLibrary(passcode: string) {
    const code = passcode.trim()
    if (!code) return
    setLibraryLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jeopardy/library?passcode=${encodeURIComponent(code)}`, { cache: 'no-store' })
      if (res.status === 401) {
        setError('Wrong passcode')
        setTimeout(() => setError(null), 3000)
        setLibraryItems(null)
        localStorage.removeItem(LIBRARY_PASSCODE_KEY)
        return
      }
      if (!res.ok) throw new Error('fail')
      const data = await res.json()
      setLibraryItems(Array.isArray(data.items) ? data.items : [])
      setLibraryPasscode(code)
      localStorage.setItem(LIBRARY_PASSCODE_KEY, code)
    } catch {
      setError('Could not load library')
      setTimeout(() => setError(null), 3000)
    } finally {
      setLibraryLoading(false)
    }
  }

  function lockLibrary() {
    localStorage.removeItem(LIBRARY_PASSCODE_KEY)
    setLibraryPasscode('')
    setLibraryItems(null)
  }

  async function importFromLibrary(filename: string) {
    setImportingFile(filename)
    setError(null)
    try {
      const ident = getOrCreateIdentity()
      const res = await fetch(`/api/jeopardy/library/${encodeURIComponent(filename)}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: libraryPasscode, editorName: ident.name }),
      })
      if (!res.ok) throw new Error('fail')
      const data = await res.json()
      router.push(`/games/jeopardy/edit/${data.slug}`)
    } catch {
      setError('Failed to open from library')
      setTimeout(() => setError(null), 3000)
    } finally {
      setImportingFile(null)
    }
  }

  async function createBoard(payload?: { board?: unknown; title?: string }) {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/jeopardy/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      })
      if (!res.ok) throw new Error('Failed to create board')
      const data = await res.json()
      router.push(`/games/jeopardy/edit/${data.slug}`)
    } catch {
      setError('Could not create board. Check your connection and try again.')
      setTimeout(() => setError(null), 3500)
    } finally {
      setCreating(false)
    }
  }

  function handleJoin() {
    const raw = joinCode.trim()
    // Magic library-unlock trigger: typing the passcode in the join field reveals the saved library.
    if (raw === LIBRARY_TRIGGER) {
      setJoinCode('')
      void unlockLibrary(raw)
      return
    }
    const code = raw.toLowerCase()
    if (!/^[a-z0-9-]{3,}$/.test(code)) {
      setError('Enter a valid board code or link')
      setTimeout(() => setError(null), 3000)
      return
    }
    // Accept either a slug or a full URL
    const m = code.match(/\/edit\/([a-z0-9-]+)/) || code.match(/\/play\/([a-z0-9-]+)/)
    const slug = m?.[1] || code
    router.push(`/games/jeopardy/edit/${slug}`)
  }

  return (
    <div className="flex items-center justify-center p-4">
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
          {error}
        </div>
      )}
      <div className="rounded-lg border max-w-lg w-full shadow-sm p-8" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h1 className="text-4xl font-bold font-lora text-center flex items-center justify-center gap-3 mb-2" style={{ color: 'var(--ink-text)' }}>
          <Image src={isNotebook ? '/doodles/notebook/jeopardy.svg' : '/doodles/jeopardy.svg'} alt="" width={40} height={40} className="h-10 w-10" />
          Jeopardy with Friends
        </h1>
        <p className="text-center text-sm mb-6" style={{ color: 'var(--ink-muted)' }}>
          Create a board together in realtime. Share one link — edit from any device.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => createBoard()}
            disabled={creating}
            className="w-full text-white py-4 px-6 rounded-lg text-xl font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            {creating ? 'Creating…' : 'Create New Game'}
          </button>

          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin() }}
              placeholder="Paste link or code to join…"
              className="flex-1 px-3 py-2 rounded-lg border outline-none"
              style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            />
            <button
              onClick={handleJoin}
              className="px-4 py-2 rounded-lg border hover:opacity-90"
              style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            >
              Join
            </button>
          </div>

          <div className="grid gap-2">
            <button
              onClick={() => editFileRef.current?.click()}
              disabled={creating}
              className="w-full py-3 px-6 rounded-lg border hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            >
              Upload JSON → start collab edit
            </button>
            <input ref={editFileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const loaded = await readBoardFromFile(file)
                await createBoard({ board: loaded, title: loaded.title })
              } catch {
                setError('Failed to parse JSON')
                setTimeout(() => setError(null), 3000)
              } finally {
                e.target.value = ''
              }
            }} />
          </div>

          {libraryItems && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wide mb-2 flex items-center justify-between" style={{ color: 'var(--ink-muted)' }}>
                <span>📚 Saved library</span>
                <button onClick={lockLibrary} className="text-xs underline" style={{ color: 'var(--ink-muted)' }}>Lock</button>
              </div>
              {libraryLoading && libraryItems.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading…</div>
              ) : libraryItems.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>No saved boards yet.</div>
              ) : (
                <ul className="space-y-1">
                  {libraryItems.map((item) => (
                    <li key={item.filename} className="flex items-center gap-2">
                      <button
                        onClick={() => void importFromLibrary(item.filename)}
                        disabled={importingFile === item.filename}
                        className="flex-1 text-left px-3 py-2 rounded-lg border hover:opacity-90 truncate disabled:opacity-50"
                        style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                        title={`Open ${item.title} in a new collab board`}
                      >
                        <span className="font-semibold">{item.title}</span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                          · {item.categories}×{item.rows}
                          {importingFile === item.filename ? ' · opening…' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {recents.length > 0 && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--ink-muted)' }}>Recent boards</div>
              <ul className="space-y-1">
                {recents.slice(0, 6).map((r) => (
                  <li key={r.slug} className="flex items-center gap-2">
                    <Link
                      href={`/games/jeopardy/edit/${r.slug}`}
                      className="flex-1 px-3 py-2 rounded-lg border hover:opacity-90 truncate"
                      style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                    >
                      <span className="font-semibold">{r.title}</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--ink-muted)' }}>· {r.slug}</span>
                    </Link>
                    <Link
                      href={`/games/jeopardy/play/${r.slug}`}
                      className="px-2 py-2 rounded-lg border text-sm"
                      style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                      title="Play"
                    >▶</Link>
                    <button
                      onClick={() => { removeRecent(r.slug); setRecents(getRecents()) }}
                      className="px-2 py-2 rounded-lg border text-sm"
                      style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-muted)' }}
                      title="Remove from list"
                    >✕</button>
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
