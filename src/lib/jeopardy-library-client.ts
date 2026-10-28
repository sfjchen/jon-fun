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

/**
 * Fetches the saved library listing for a passcode.
 * Returns null for a wrong passcode and throws on other failures.
 */
async function fetchLibrary(code: string): Promise<LibraryEntry[] | null> {
  const res = await fetch(`/api/jeopardy/library?passcode=${encodeURIComponent(code)}`, { cache: 'no-store' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('fail')
  const data = await res.json()
  return Array.isArray(data.items) ? data.items : []
}

export function useJeopardyLibrary(onError: (msg: string) => void): UseJeopardyLibraryResult {
  const [passcode, setPasscode] = useState('')
  const [items, setItems] = useState<LibraryEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [importingFile, setImportingFile] = useState<string | null>(null)

  /**
   * Applies a fetched listing for a passcode, clearing the cached passcode when it was wrong.
   * Returns whether the passcode unlocked the library.
   */
  const applyListing = useCallback(
    (code: string, list: LibraryEntry[] | null): boolean => {
      if (!list) {
        onError('Wrong passcode')
        setItems(null)
        localStorage.removeItem(LIBRARY_PASSCODE_KEY)
        return false
      }
      setItems(list)
      setPasscode(code)
      localStorage.setItem(LIBRARY_PASSCODE_KEY, code)
      return true
    },
    [onError],
  )

  const unlock = useCallback(
    async (raw: string): Promise<boolean> => {
      const code = raw.trim()
      if (!code) return false
      setLoading(true)
      try {
        return applyListing(code, await fetchLibrary(code))
      } catch {
        onError('Could not load library')
        return false
      } finally {
        setLoading(false)
      }
    },
    [onError, applyListing],
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
    const stored = localStorage.getItem(LIBRARY_PASSCODE_KEY)?.trim()
    if (!stored) return
    fetchLibrary(stored)
      .then((list) => applyListing(stored, list))
      .catch(() => onError('Could not load library'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { passcode, items, loading, importingFile, unlock, lock, importEntry }
}
