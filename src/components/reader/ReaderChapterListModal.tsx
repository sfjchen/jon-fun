'use client'

import { createPortal } from 'react-dom'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ReaderChapter } from '@/lib/reader/types'

type ReaderChapterListModalProps = {
  open: boolean
  onClose: () => void
  chapters: ReaderChapter[]
  currentChapterId: string
  currentIndex: number
  onSelectChapter: (id: string) => void
  /** Reader theme CSS variables (portal is outside `section` style scope). */
  readerThemeVars: CSSProperties
}

const LARGE_BOOK = 320

export function ReaderChapterListModal({
  open,
  onClose,
  chapters,
  currentChapterId,
  currentIndex,
  onSelectChapter,
  readerThemeVars,
}: ReaderChapterListModalProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const activeRef = useRef<HTMLButtonElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    setQuery('')
  }, [open, currentChapterId])

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [open, currentChapterId, deferredQuery])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const { rows, truncated } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const indexed = chapters.map((c, i) => ({ c, i }))
    if (q) {
      return {
        rows: indexed.filter(({ c, i }) => {
          const label = `${i + 1}. ${c.title}`.toLowerCase()
          return label.includes(q) || `${i + 1}`.includes(q)
        }),
        truncated: false,
      }
    }
    if (chapters.length <= LARGE_BOOK) {
      return { rows: indexed, truncated: false }
    }
    const pad = 24
    const from = Math.max(0, currentIndex - pad)
    const to = Math.min(chapters.length, currentIndex + pad + 1)
    return { rows: indexed.slice(from, to), truncated: true }
  }, [chapters, currentIndex, deferredQuery])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      style={readerThemeVars}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex h-[min(88dvh,100dvh)] w-full max-w-lg flex-col rounded-t-2xl border shadow-2xl sm:h-[min(82vh,40rem)] sm:rounded-2xl"
        style={{
          borderColor: 'var(--reader-border)',
          backgroundColor: 'var(--reader-panel)',
          color: 'var(--reader-text)',
        }}
        role="dialog"
        aria-modal
        aria-labelledby="reader-chapter-list-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--reader-border)' }}>
          <h2 id="reader-chapter-list-title" className="text-base font-semibold">
            Chapter list
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="reader-focus rounded-full px-3 py-2 text-sm font-medium"
            style={{
              border: '1px solid var(--reader-border)',
              backgroundColor: 'var(--reader-bg)',
              color: 'var(--reader-text)',
            }}
            aria-label="Close chapter list"
          >
            ✕
          </button>
        </div>

        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--reader-border)' }}>
          <label className="block">
            <span className="sr-only">Search chapters</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${chapters.length.toLocaleString()} chapters…`}
              className="reader-focus w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{
                borderColor: 'var(--reader-border)',
                backgroundColor: 'var(--reader-bg)',
                color: 'var(--reader-text)',
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {truncated ? (
            <p className="mt-2 text-xs" style={{ color: 'var(--reader-muted)' }}>
              Showing chapters near your position. Search to jump to any chapter.
            </p>
          ) : null}
        </div>

        <ul className="reader-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2 pb-safe" role="listbox" aria-label="Chapters">
          {rows.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm" style={{ color: 'var(--reader-muted)' }}>
              No chapters match your search.
            </li>
          ) : (
            rows.map(({ c, i }) => {
              const row = `${i + 1}. ${c.title}`
              const active = c.id === currentChapterId
              return (
                <li key={c.id} className="py-0.5">
                  <button
                    ref={active ? activeRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className="reader-focus w-full rounded-xl px-3 py-3 text-left text-sm"
                    style={{
                      border: active ? '2px solid var(--reader-accent)' : '1px solid transparent',
                      backgroundColor: active
                        ? 'color-mix(in srgb, var(--reader-accent) 14%, var(--reader-panel))'
                        : 'transparent',
                      color: 'var(--reader-text)',
                    }}
                    title={row}
                    onClick={() => {
                      onSelectChapter(c.id)
                      onClose()
                    }}
                  >
                    <span className="block truncate">{row}</span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
