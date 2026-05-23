'use client'

// Client-side hook: passcode-gated saved-library access. Caches passcode in
// localStorage. `unlock` returns true on success so callers can chain UX flow.

import { useCallback, useEffect, useState } from 'react'
import { getOrCreateIdentity } from '@/lib/jeopardy-identity'

const LIBRARY_PASSCODE_KEY = 'jeopardy:library-passcode'

export interface LibraryEntry {
  filename: string
  title: string
  categories: number
  rows: number
}

export interface UseJeopardyLibraryResult {
  passcode: string
  items: LibraryEntry[] | null
  loading: boolean
  importingFile: string | null
  unlock: (passcode: string) => Promise<boolean>
  lock: () => void
  importEntry: (filename: string) => Promise<string | null> // returns slug on success
}

export function useJeopardyLibrary(onError: (msg: string) => void): UseJeopardyLibraryResult {
  const [passcode, setPasscode] = useState('')
  const [items, setItems] = useState<LibraryEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [importingFile, setImportingFile] = useState<string | null>(null)

  const unlock = useCallback(
    async (raw: string): Promise<boolean> => {
      const code = raw.trim()
      if (!code) return false
      setLoading(true)
      try {
        const res = await fetch(`/api/jeopardy/library?passcode=${encodeURIComponent(code)}`, { cache: 'no-store' })
        if (res.status === 401) {
          onError('Wrong passcode')
          setItems(null)
          localStorage.removeItem(LIBRARY_PASSCODE_KEY)
          return false
        }
        if (!res.ok) throw new Error('fail')
        const data = await res.json()
        setItems(Array.isArray(data.items) ? data.items : [])
        setPasscode(code)
        localStorage.setItem(LIBRARY_PASSCODE_KEY, code)
        return true
      } catch {
        onError('Could not load library')
        return false
      } finally {
        setLoading(false)
      }
    },
    [onError],
  )

  const lock = useCallback(() => {
    localStorage.removeItem(LIBRARY_PASSCODE_KEY)
    setPasscode('')
    setItems(null)
  }, [])

  const importEntry = useCallback(
    async (filename: string): Promise<string | null> => {
      setImportingFile(filename)
      try {
        const ident = getOrCreateIdentity()
        const res = await fetch(`/api/jeopardy/library/${encodeURIComponent(filename)}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode, editorName: ident.name }),
        })
        if (!res.ok) throw new Error('fail')
        const data = await res.json()
        return typeof data.slug === 'string' ? data.slug : null
      } catch {
        onError('Failed to open from library')
        return null
      } finally {
        setImportingFile(null)
      }
    },
    [passcode, onError],
  )

  // Resume from cached passcode on mount.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(LIBRARY_PASSCODE_KEY) : null
    if (stored) void unlock(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { passcode, items, loading, importingFile, unlock, lock, importEntry }
}
