'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import JeopardyPlayer from '@/components/JeopardyPlayer'
import type { JeopardyBoard } from '@/lib/jeopardy'
import { normalizeBoard } from '@/lib/jeopardy-ops'
import { pushRecent } from '@/lib/jeopardy-identity'

export default function JeopardyPlayPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const slug = params?.slug || ''
  const [board, setBoard] = useState<JeopardyBoard | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
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
        setVersion(data.version ?? 0)
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
          const row = payload.new as Record<string, unknown> | null
          if (!row) return
          const incoming = typeof row.version === 'number' ? row.version : 0
          if (incoming <= version) return
          setBoard(normalizeBoard(row.board, (row.id as string) || ''))
          setVersion(incoming)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void ch.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

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
      onBack={() => router.push('/games/jeopardy')}
      onEdit={() => router.push(`/games/jeopardy/edit/${slug}`)}
    />
  )
}
