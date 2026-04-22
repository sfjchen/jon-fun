'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ReaderChapterListModal } from '@/components/reader/ReaderChapterListModal'
import type { ReaderChapter } from '@/lib/reader/types'

type ReaderChapterEndNavProps = {
  chapters: ReaderChapter[]
  chapterId: string
  currentIndex: number
  canGoPrev: boolean
  canGoNext: boolean
  onGoToChapter: (id: string) => void
  readerThemeVars: CSSProperties
}

export function ReaderChapterEndNav({
  chapters,
  chapterId,
  currentIndex,
  canGoPrev,
  canGoNext,
  onGoToChapter,
  readerThemeVars,
}: ReaderChapterEndNavProps) {
  const [listOpen, setListOpen] = useState(false)
  const chapter = chapters[currentIndex]
  const prevId = currentIndex > 0 ? chapters[currentIndex - 1]?.id ?? '' : ''
  const nextId = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1]?.id ?? '' : ''

  if (!chapter) return null

  const label = `${currentIndex + 1}. ${chapter.title}`

  return (
    <>
      <ReaderChapterListModal
        open={listOpen}
        onClose={() => setListOpen(false)}
        chapters={chapters}
        currentChapterId={chapterId}
        currentIndex={currentIndex}
        onSelectChapter={onGoToChapter}
        readerThemeVars={readerThemeVars}
      />

      <nav
        className="rounded-2xl border px-1 py-3 sm:px-2"
        style={{
          borderColor: 'var(--reader-border)',
          backgroundColor: 'color-mix(in srgb, var(--reader-panel) 40%, transparent)',
        }}
        aria-label="Chapter navigation"
      >
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            disabled={!canGoPrev}
            onClick={() => prevId && onGoToChapter(prevId)}
            className="reader-focus flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border px-2 text-sm font-semibold disabled:opacity-40 sm:min-h-12 sm:min-w-12 sm:px-3"
            style={{
              borderColor: 'var(--reader-border)',
              backgroundColor: 'color-mix(in srgb, var(--reader-accent) 12%, var(--reader-panel))',
              color: 'var(--reader-text)',
            }}
            aria-label="Previous chapter"
          >
            <span aria-hidden>‹</span>
          </button>

          <button
            type="button"
            className="reader-focus flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-left text-sm font-medium sm:min-h-12 sm:px-3"
            style={{
              borderColor: 'var(--reader-border)',
              backgroundColor: 'var(--reader-panel)',
              color: 'var(--reader-text)',
            }}
            aria-expanded={listOpen}
            aria-haspopup="dialog"
            onClick={() => setListOpen(true)}
            title={label}
          >
            <span className="min-w-0 flex-1 truncate text-center">{label}</span>
            <span className="shrink-0 text-base leading-none opacity-80" aria-hidden>
              ▼
            </span>
          </button>

          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => nextId && onGoToChapter(nextId)}
            className="reader-focus flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border px-2 text-sm font-semibold disabled:opacity-40 sm:min-h-12 sm:min-w-12 sm:px-3"
            style={{
              borderColor: 'var(--reader-border)',
              backgroundColor: 'color-mix(in srgb, var(--reader-accent) 12%, var(--reader-panel))',
              color: 'var(--reader-text)',
            }}
            aria-label="Next chapter"
          >
            <span aria-hidden>›</span>
          </button>
        </div>
      </nav>
    </>
  )
}
