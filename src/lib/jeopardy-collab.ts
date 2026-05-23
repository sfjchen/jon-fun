'use client'

// Realtime collaborative editing hook for a single Jeopardy board.
// - REST: GET initial state, PATCH each operation (optimistic concurrency).
// - Realtime: postgres_changes refreshes board on any DB write.
// - Presence: tracks active collaborators.
// - Broadcast: per-cell "X is editing" locks (instant, no DB).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { JeopardyBoard } from '@/lib/jeopardy'
import { applyOp, normalizeBoard, type JeopardyOp } from '@/lib/jeopardy-ops'
import type { EditorIdentity } from '@/lib/jeopardy-identity'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline'

export interface Collaborator {
  id: string
  name: string
  color: string
  online_at: string
}

// Lock key = `${col}:${row}` or 'title' or `cat:${col}`
export type LockKey = string
export interface Lock {
  by: string
  name: string
  color: string
}

interface CollabState {
  board: JeopardyBoard | null
  version: number
  updatedAt: string | null
  lastEditor: string
  loading: boolean
  notFound: boolean
  collaborators: Collaborator[]
  locks: Record<LockKey, Lock>
  saveStatus: SaveStatus
  pendingOps: number
}

export interface UseCollabBoardResult extends CollabState {
  sendOp: (op: JeopardyOp) => void
  setLock: (key: LockKey | null) => void
  refresh: () => Promise<void>
}

export function useCollabBoard(slug: string | null, identity: EditorIdentity | null): UseCollabBoardResult {
  const [state, setState] = useState<CollabState>({
    board: null,
    version: 0,
    updatedAt: null,
    lastEditor: '',
    loading: true,
    notFound: false,
    collaborators: [],
    locks: {},
    saveStatus: 'idle',
    pendingOps: 0,
  })

  const stateRef = useRef(state)
  stateRef.current = state

  const myLockRef = useRef<LockKey | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pendingRef = useRef(0)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editorName = identity?.name || 'Anonymous'
  const editorId = identity?.id || ''
  const editorColor = identity?.color || '#3b82f6'

  // ----- Initial fetch + realtime subscriptions -----
  const fetchBoard = useCallback(async (): Promise<void> => {
    if (!slug) return
    try {
      const res = await fetch(`/api/jeopardy/boards/${slug}`, { cache: 'no-store' })
      if (res.status === 404) {
        setState((s) => ({ ...s, loading: false, notFound: true }))
        return
      }
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, saveStatus: 'error' }))
        return
      }
      const data = await res.json()
      setState((s) => ({
        ...s,
        board: normalizeBoard(data.board, data.board?.id ?? ''),
        version: data.version ?? 0,
        updatedAt: data.updatedAt ?? null,
        lastEditor: data.lastEditor ?? '',
        loading: false,
        notFound: false,
      }))
    } catch {
      setState((s) => ({ ...s, loading: false, saveStatus: 'offline' }))
    }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    void fetchBoard()
  }, [slug, fetchBoard])

  // Subscribe to DB row updates so other clients see writes.
  useEffect(() => {
    if (!slug) return
    const ch = supabase
      .channel(`jeopardy:row:${slug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jeopardy_boards', filter: `slug=eq.${slug}` },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null
          if (!row) {
            if (payload.eventType === 'DELETE') setState((s) => ({ ...s, notFound: true }))
            return
          }
          // Only accept newer versions.
          const incomingVersion = typeof row.version === 'number' ? row.version : 0
          if (incomingVersion <= stateRef.current.version) return
          setState((s) => ({
            ...s,
            board: normalizeBoard(row.board, (row.id as string) || ''),
            version: incomingVersion,
            updatedAt: (row.updated_at as string) || s.updatedAt,
            lastEditor: (row.last_editor as string) || s.lastEditor,
          }))
        },
      )
      .subscribe()
    return () => {
      void ch.unsubscribe()
    }
  }, [slug])

  // Presence + lock broadcast channel.
  useEffect(() => {
    if (!slug || !editorId) return
    const ch = supabase.channel(`jeopardy:collab:${slug}`, {
      config: { presence: { key: editorId } },
    })

    ch.on('presence', { event: 'sync' }, () => {
      const presenceState = ch.presenceState() as Record<string, Array<Record<string, unknown>>>
      const collaborators: Collaborator[] = []
      const locks: Record<LockKey, Lock> = {}
      for (const id of Object.keys(presenceState)) {
        const arr = presenceState[id] ?? []
        const meta = arr[0]
        if (!meta) continue
        const name = (meta.name as string) || 'Anonymous'
        const color = (meta.color as string) || '#888'
        const online_at = (meta.online_at as string) || new Date().toISOString()
        collaborators.push({ id, name, color, online_at })
        const lockKey = (meta.lock as string | null) || null
        if (lockKey && id !== editorId) {
          locks[lockKey] = { by: id, name, color }
        }
      }
      setState((s) => ({ ...s, collaborators, locks }))
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({
          name: editorName,
          color: editorColor,
          online_at: new Date().toISOString(),
          lock: myLockRef.current,
        })
      }
    })

    channelRef.current = ch
    return () => {
      channelRef.current = null
      void ch.untrack().catch(() => {})
      void ch.unsubscribe()
    }
  }, [slug, editorId, editorName, editorColor])

  // ----- Send op -----
  const scheduleSavedClear = useCallback(() => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => {
      setState((ss) => (ss.saveStatus === 'saved' ? { ...ss, saveStatus: 'idle' } : ss))
    }, 1500)
  }, [])

  const sendOp = useCallback(
    (op: JeopardyOp) => {
      if (!slug) return
      pendingRef.current += 1
      // Optimistic local apply + saving status.
      setState((s) => {
        if (!s.board) return { ...s, saveStatus: 'saving', pendingOps: pendingRef.current }
        return { ...s, board: applyOp(s.board, op), saveStatus: 'saving', pendingOps: pendingRef.current }
      })

      void (async () => {
        let ok = false
        try {
          const res = await fetch(`/api/jeopardy/boards/${slug}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op, editorName }),
          })
          if (!res.ok) throw new Error(`status ${res.status}`)
          const data = await res.json()
          ok = true
          setState((s) => {
            const newVersion = data.version ?? s.version
            if (newVersion < s.version) return s
            return {
              ...s,
              board: normalizeBoard(data.board, data.board?.id ?? ''),
              version: newVersion,
              updatedAt: data.updatedAt ?? s.updatedAt,
              lastEditor: data.lastEditor ?? s.lastEditor,
            }
          })
        } catch {
          // network/server fail — keep optimistic state, mark error
        } finally {
          pendingRef.current = Math.max(0, pendingRef.current - 1)
          setState((s) => {
            const pending = pendingRef.current
            let status: SaveStatus = s.saveStatus
            if (!ok) status = 'error'
            else if (pending === 0) status = 'saved'
            else status = 'saving'
            return { ...s, pendingOps: pending, saveStatus: status }
          })
          if (ok && pendingRef.current === 0) scheduleSavedClear()
        }
      })()
    },
    [slug, editorName, scheduleSavedClear],
  )

  // ----- Lock / unlock current cell (presence-tracked) -----
  const setLock = useCallback((key: LockKey | null) => {
    myLockRef.current = key
    const ch = channelRef.current
    if (!ch) return
    void ch
      .track({
        name: editorName,
        color: editorColor,
        online_at: new Date().toISOString(),
        lock: key,
      })
      .catch(() => {})
  }, [editorName, editorColor])

  return useMemo<UseCollabBoardResult>(
    () => ({ ...state, sendOp, setLock, refresh: fetchBoard }),
    [state, sendOp, setLock, fetchBoard],
  )
}
