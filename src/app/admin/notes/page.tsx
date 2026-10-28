'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

const ADMIN_KEY = 'notes_admin_ok'

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
  /* Reads the URL or session key on the client so the first client render knows an auto-load is pending. */
  const autoKey = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('key') || sessionStorage.getItem(ADMIN_KEY),
    () => null,
  )
  const [loadingState, setLoading] = useState<boolean | null>(null)
  const loading = loadingState ?? Boolean(autoKey)

  /*
   * Fetches sessions for the key. Callers outside the auto-load set loading and clear the error first.
   */
  const fetchData = useCallback((adminKey: string, userId?: string) => {
    const q = new URLSearchParams({ key: adminKey })
    if (userId) q.set('userId', userId)
    return fetch(`/api/notes/admin/sessions?${q}`)
      .then(async (res) => {
        if (res.status === 401) return setError('Invalid key')
        if (!res.ok) return setError('Failed to load')
        const data = (await res.json()) as { sessions?: SessionRow[]; userIds?: string[] }
        setSessions(data.sessions ?? [])
        setUserIds(data.userIds ?? [])
        setAuthorized(true)
        sessionStorage.setItem(ADMIN_KEY, adminKey)
      })
      .catch(() => setError('Request failed'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (autoKey && !authorized) void fetchData(autoKey)
  }, [autoKey, authorized, fetchData])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 font-lora text-2xl font-semibold">Notes — Admin</h1>

      {!authorized ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!key.trim()) return
            setLoading(true)
            setError(null)
            void fetchData(key.trim())
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
                  if (!stored) return
                  setLoading(true)
                  setError(null)
                  void fetchData(stored, e.target.value || undefined)
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
