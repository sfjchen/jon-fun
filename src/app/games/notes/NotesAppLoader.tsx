'use client'

import dynamic from 'next/dynamic'

const NotesApp = dynamic(() => import('@/components/notes/NotesApp'), {
  ssr: false,
  loading: () => (
    <div
      className="notes-root flex min-h-0 flex-1 flex-col items-center justify-center bg-[var(--uv-bg-base)] px-4 py-12 text-sm text-[var(--uv-text-muted)]"
      data-testid="notes-loading"
    >
      Loading notes…
    </div>
  ),
})

export default function NotesAppLoader() {
  return <NotesApp />
}
