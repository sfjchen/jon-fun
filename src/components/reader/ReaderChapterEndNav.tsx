'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReaderChapter } from '@/lib/reader/types'

type ReaderChapterEndNavProps = {
  chapters: ReaderChapter[]
  chapterId: string
  currentIndex: number
  canGoPrev: boolean
  canGoNext: boolean
  onGoToChapter: (id: string) => void
}

export function ReaderChapterEndNav({
  chapters,
  chapterId,
  currentIndex,
  canGoPrev,
  canGoNext,
  onGoToChapter,
}: ReaderChapterEndNavProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const chapter = chapters[currentIndex]
  const prevId = currentIndex > 0 ? chapters[currentIndex - 1]?.id : ''
  const nextId = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1]?.id : ''

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current
      if (el && e.target instanceof Node && !el.contains(e.target)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  useEffect(() => {
    setOpen(false)
  }, [chapterId])

  if (!chapter) return null

  const label = `${currentIndex + 1}. ${chapter.title}`

  return (
    <nav
      className="mt-10 border-t pt-6"
      style={{ borderColor: 'var(--reader-border)' }}
      aria-label="Chapter navigation"
    >
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => prevId && onGoToChapter(prevId)}
          className="reader-focus shrink-0 rounded-xl border px-3 py-3 text-sm font-medium disabled:opacity-40"
          style={{
            borderColor: 'var(--reader-border)',
            backgroundColor: 'color-mix(in srgb, var(--reader-accent) 12%, var(--reader-panel))',
            color: 'var(--reader-text)',
          }}
        >
          ← Prev
        </button>

        <div ref={wrapRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            className="reader-focus flex h-full w-full min-w-0 items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-medium"
            style={{
              borderColor: 'var(--reader-border)',
              backgroundColor: 'var(--reader-panel)',
              color: 'var(--reader-text)',
            }}
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={() => setOpen((v) => !v)}
            title={label}
          >
            <span className="block max-w-full truncate">{label}</span>
          </button>
          {open ? (
            <ul
              className="reader-scrollbar absolute bottom-full left-0 right-0 z-20 mb-1 max-h-[min(50vh,18rem)] overflow-y-auto rounded-xl border py-1 shadow-lg"
              style={{
                borderColor: 'var(--reader-border)',
                backgroundColor: 'var(--reader-panel)',
                color: 'var(--reader-text)',
              }}
              role="listbox"
              aria-label="Chapters"
            >
              {chapters.map((c, index) => {
                const row = `${index + 1}. ${c.title}`
                const active = c.id === chapterId
                return (
                  <li key={c.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className="reader-focus block w-full px-3 py-2.5 text-left text-sm hover:opacity-90"
                      style={{
                        backgroundColor: active
                          ? 'color-mix(in srgb, var(--reader-accent) 20%, var(--reader-panel))'
                          : 'transparent',
                      }}
                      title={row}
                      onClick={() => {
                        onGoToChapter(c.id)
                        close()
                      }}
                    >
                      <span className="block truncate">{row}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => nextId && onGoToChapter(nextId)}
          className="reader-focus shrink-0 rounded-xl border px-3 py-3 text-sm font-medium disabled:opacity-40"
          style={{
            borderColor: 'var(--reader-border)',
            backgroundColor: 'color-mix(in srgb, var(--reader-accent) 12%, var(--reader-panel))',
            color: 'var(--reader-text)',
          }}
        >
          Next →
        </button>
      </div>
    </nav>
  )
}
