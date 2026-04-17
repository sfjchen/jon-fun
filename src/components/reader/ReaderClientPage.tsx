'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ReaderShell } from '@/components/reader/ReaderShell'
import { getReaderPublication } from '@/lib/reader/publications'
import type { ReaderPublication } from '@/lib/reader/types'

type ReaderClientPageProps = {
  bookId: string
  chapterId: string
  routeBase: string
}

export function ReaderClientPage({ bookId, chapterId, routeBase }: ReaderClientPageProps) {
  const [publication, setPublication] = useState<ReaderPublication | null>(null)
  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading')

  useEffect(() => {
    let active = true

    void getReaderPublication(bookId).then((next) => {
      if (!active) return
      if (!next) {
        setStatus('missing')
        return
      }
      setPublication(next)
      setStatus('ready')
    })

    return () => {
      active = false
    }
  }, [bookId])

  if (status === 'loading') {
    return (
      <div className="rounded-3xl border px-5 py-10 text-center" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-muted)' }}>
        Loading your local reader library…
      </div>
    )
  }

  if (status === 'missing' || !publication) {
    return (
      <div className="rounded-3xl border px-5 py-10 text-center" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-muted)' }}>
        <p className="mb-4">That local book is not available on this browser anymore.</p>
        <Link href={routeBase} className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
          Back to import library
        </Link>
      </div>
    )
  }

  return <ReaderShell publication={publication} initialChapterId={chapterId} routeBase={routeBase} />
}
