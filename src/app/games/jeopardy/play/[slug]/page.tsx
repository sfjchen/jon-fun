'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import JeopardyPlayer from '@/components/JeopardyPlayer'
import BuzzerHostPanel from '@/components/BuzzerHostPanel'
import type { JeopardyBoard } from '@/lib/jeopardy'
import { normalizeBoard } from '@/lib/jeopardy-ops'
import { pushRecent } from '@/lib/jeopardy-identity'
import {
  applyPlayOp,
  defaultPlayState,
  normalizePlayState,
  type JeopardyPlayOp,
  type JeopardyPlayState,
} from '@/lib/jeopardy-play-ops'

export default function JeopardyPlayPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const slug = params?.slug || ''
  const [board, setBoard] = useState<JeopardyBoard | null>(null)
  const [playState, setPlayState] = useState<JeopardyPlayState>(defaultPlayState())
  const [notFound, setNotFound] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [buzzerEnabled, setBuzzerEnabled] = useState(false)
  const versionRef = useRef(0)
  const playVersionRef = useRef(0) // version of the play_state currently applied to React state
  const seenPlayVersionRef = useRef(0) // highest play_version observed via realtime (may be ahead of applied)
  const pendingRef = useRef(0) // counts in-flight ops; suppress realtime overwrite while we have local-only changes

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    versionRef.current = 0
    playVersionRef.current = 0
    seenPlayVersionRef.current = 0
    async function load() {
      try {
        const res = await fetch(`/api/jeopardy/boards/${slug}`, { cache: 'no-store' })
        if (res.status === 404) {
          if (!cancelled) setNotFound(true)
          return
        }
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setBoard(normalizeBoard(data.board, data.board?.id ?? ''))
        versionRef.current = data.version ?? 0
        setPlayState(normalizePlayState(data.playState))
        playVersionRef.current = data.playVersion ?? 0
        seenPlayVersionRef.current = data.playVersion ?? 0
        if (data.board?.title) pushRecent(slug, data.board.title)
      } catch {}
    }
    void load()

    const ch = supabase
      .channel(`jeopardy:play:${slug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jeopardy_boards', filter: `slug=eq.${slug}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setNotFound(true)
            return
          }
          const row = payload.new as Record<string, unknown> | null
          if (!row) return
          const incoming = typeof row.version === 'number' ? row.version : 0
          if (incoming > versionRef.current) {
            setBoard(normalizeBoard(row.board, (row.id as string) || ''))
            versionRef.current = incoming
          }
          const incomingPlay = typeof row.play_version === 'number' ? row.play_version : 0
          // Always track the highest version we've observed (used to detect "we missed updates while busy").
          if (incomingPlay > seenPlayVersionRef.current) seenPlayVersionRef.current = incomingPlay
          // Only apply when we have no in-flight optimistic ops (otherwise the echo could overwrite
          // unflushed local changes). When pending drains, we'll refetch to catch up — see dispatchPlayOp.
          if (incomingPlay > playVersionRef.current && pendingRef.current === 0) {
            setPlayState(normalizePlayState(row.play_state))
            playVersionRef.current = incomingPlay
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void ch.unsubscribe()
    }
  }, [slug])

  const dispatchPlayOp = useCallback(
    (op: JeopardyPlayOp) => {
      // Optimistic local apply.
      setPlayState((prev) => applyPlayOp(prev, op))
      pendingRef.current += 1
      setSyncing(true)
      ;(async () => {
        try {
          const res = await fetch(`/api/jeopardy/boards/${slug}/play-state`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op }),
          })
          if (res.ok) {
            const data = await res.json()
            if (typeof data.playVersion === 'number' && data.playVersion > playVersionRef.current) {
              playVersionRef.current = data.playVersion
              if (data.playVersion > seenPlayVersionRef.current) seenPlayVersionRef.current = data.playVersion
              setPlayState(normalizePlayState(data.playState))
            }
          } else if (res.status === 409 || res.status === 404) {
            // Conflict or missing — refetch to reconcile.
            const r = await fetch(`/api/jeopardy/boards/${slug}`, { cache: 'no-store' })
            if (r.ok) {
              const d = await r.json()
              setPlayState(normalizePlayState(d.playState))
              playVersionRef.current = d.playVersion ?? 0
              if ((d.playVersion ?? 0) > seenPlayVersionRef.current) seenPlayVersionRef.current = d.playVersion ?? 0
            }
          }
        } catch {
          /* offline; local state still updated, realtime will reconcile when back */
        } finally {
          pendingRef.current = Math.max(0, pendingRef.current - 1)
          if (pendingRef.current === 0) {
            setSyncing(false)
            // If realtime fan-out delivered higher versions while we were busy, catch up now.
            if (seenPlayVersionRef.current > playVersionRef.current) {
              void (async () => {
                try {
                  const r = await fetch(`/api/jeopardy/boards/${slug}`, { cache: 'no-store' })
                  if (!r.ok) return
                  const d = await r.json()
                  if ((d.playVersion ?? 0) > playVersionRef.current) {
                    setPlayState(normalizePlayState(d.playState))
                    playVersionRef.current = d.playVersion ?? 0
                  }
                } catch {}
              })()
            }
          }
        }
      })()
    },
    [slug],
  )

  if (notFound) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ink-text)' }}>Board not found</h2>
        <button onClick={() => router.push('/games/jeopardy')} className="px-4 py-2 rounded-lg border" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>Back to menu</button>
      </div>
    )
  }

  if (!board) return <div className="p-8 text-center" style={{ color: 'var(--ink-muted)' }}>Loading…</div>

  return (
    <JeopardyPlayer
      board={board}
      playState={playState}
      dispatchPlayOp={dispatchPlayOp}
      syncing={syncing}
      onBack={() => router.push('/games/jeopardy')}
      onEdit={() => router.push(`/games/jeopardy/edit/${slug}`)}
      buzzerEnabled={buzzerEnabled}
      onBuzzerToggle={setBuzzerEnabled}
      buzzerSlot={
        <BuzzerHostPanel
          slug={slug}
          playState={playState}
          dispatchPlayOp={dispatchPlayOp}
          onClose={() => setBuzzerEnabled(false)}
        />
      }
    />
  )
}
