'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

const ADMIN_KEY = 'uvimco_notes_admin_ok'

type SessionRow = {
  user_id: string
  session_id: string
  title: string
  notes: string
  lookups: unknown
  started_at: string
  updated_at: string
}

export default function UvimcoNotesAdminPage() {
  const [key, setKey] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [userIds, setUserIds] = useState<string[]>([])
  const [filterUser, setFilterUser] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (adminKey: string, userId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ key: adminKey })
      if (userId) q.set('userId', userId)
      const res = await fetch(`/api/uvimco-notes/admin/sessions?${q}`)
      if (res.status === 401) {
        setError('Invalid key')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError('Failed to load')
        setLoading(false)
        return
      }
      const data = (await res.json()) as { sessions?: SessionRow[]; userIds?: string[] }
      setSessions(data.sessions ?? [])
      setUserIds(data.userIds ?? [])
      setAuthorized(true)
      if (typeof window !== 'undefined') sessionStorage.setItem(ADMIN_KEY, adminKey)
    } catch {
      setError('Request failed')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const urlKey = q.get('key')
    const stored = sessionStorage.getItem(ADMIN_KEY)
    if (urlKey) void fetchData(urlKey)
    else if (stored) void fetchData(stored)
  }, [fetchData])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="mb-4">
        <Link href="/" className="text-sm text-[var(--ink-accent)] hover:underline">
          ← Home
        </Link>
      </p>
      <h1 className="mb-6 font-lora text-2xl font-semibold">Notes — Admin</h1>

      {!authorized ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (key.trim()) void fetchData(key.trim())
          }}
          className="max-w-sm space-y-3"
        >
          <label className="block text-sm">
            Admin secret
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--ink-border)' }}
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" className="rounded px-4 py-2 text-sm text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
            {loading ? 'Loading…' : 'View sessions'}
          </button>
        </form>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="text-sm">
              Filter user
              <select
                value={filterUser}
                onChange={(e) => {
                  setFilterUser(e.target.value)
                  const stored = sessionStorage.getItem(ADMIN_KEY)
                  if (stored) void fetchData(stored, e.target.value || undefined)
                }}
                className="ml-2 rounded border px-2 py-1 text-sm"
              >
                <option value="">All</option>
                {userIds.map((id) => (
                  <option key={id} value={id}>
                    {id.slice(0, 8)}…
                  </option>
                ))}
              </select>
            </label>
            <span className="text-sm text-[var(--ink-muted)]">{sessions.length} sessions</span>
          </div>
          <ul className="space-y-4">
            {sessions.map((s) => (
              <li key={`${s.user_id}-${s.session_id}`} className="rounded border p-4" style={{ borderColor: 'var(--ink-border)' }}>
                <div className="mb-2 flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
                  <span>{s.title || 'Untitled'}</span>
                  <span>·</span>
                  <span>{new Date(s.updated_at).toLocaleString()}</span>
                  <span>·</span>
                  <span className="font-mono">{s.user_id.slice(0, 8)}…</span>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{s.notes.slice(0, 2000)}</pre>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
