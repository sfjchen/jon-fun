'use client'

import { Fragment, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { readerBlockIdForParagraph } from '@/lib/reader/blocks'
import type { ReaderChapter, ReaderPreferences } from '@/lib/reader/types'
import { escapeRegex } from '@/lib/reader/search-book'

type ReaderBodyProps = {
  chapter: ReaderChapter
  prefs: ReaderPreferences
  /** When set, all case-insensitive occurrences are wrapped in `<mark>` (still combines with bionic outside matches). */
  highlightQuery?: string
  /** Reading band focus (dims outside band). */
  focusBand?: boolean
  /** Per-paragraph discussion gutter (+ / count); omitted when comments API unavailable. */
  commentGutter?: {
    countsByBlock: Record<string, number>
    highlightBlockId: string | null
    onOpenThread: (blockId: string) => void
  }
}

function bionicSplit(word: string): { lead: string; tail: string } {
  const plain = word.trim()
  if (!plain) return { lead: '', tail: '' }
  const cutoff = Math.max(1, Math.ceil(plain.length * 0.45))
  return {
    lead: plain.slice(0, cutoff),
    tail: plain.slice(cutoff),
  }
}

function renderBionicParagraph(paragraph: string) {
  return paragraph.split(/(\s+)/).map((token, tokenIndex) => {
    if (!token.trim()) return <Fragment key={tokenIndex}>{token}</Fragment>
    const { lead, tail } = bionicSplit(token)
    return (
      <span key={tokenIndex}>
        <strong>{lead}</strong>
        {tail}
      </span>
    )
  })
}

function renderParagraphContent(paragraph: string, prefs: ReaderPreferences, highlightQuery: string) {
  const q = highlightQuery.trim()
  if (!q) {
    return prefs.bionic ? renderBionicParagraph(paragraph) : paragraph
  }

  const re = new RegExp(`(${escapeRegex(q)})`, 'gi')
  const parts = paragraph.split(re)
  return parts.map((part, i) => {
    if (part === '') return null
    const isMatch = i % 2 === 1
    if (isMatch) {
      return (
        <mark key={i} className="reader-search-match">
          {part}
        </mark>
      )
    }
    return <Fragment key={i}>{prefs.bionic ? renderBionicParagraph(part) : part}</Fragment>
  })
}

export function ReaderBody({
  chapter,
  prefs,
  highlightQuery = '',
  focusBand = false,
  commentGutter,
}: ReaderBodyProps) {
  const textAlign = prefs.textAlign
  const proseStyle = useMemo<CSSProperties>(
    () => ({
      textAlign,
      userSelect: prefs.copyEnabled ? 'text' : 'none',
    }),
    [prefs.copyEnabled, textAlign],
  )

  return (
    <article
      className="reader-prose pb-16 reader-scrollbar"
      data-indent={prefs.textIndent}
      data-focus-band={focusBand ? 'on' : 'off'}
      style={proseStyle}
      aria-label={`${chapter.title} reading text`}
    >
      {chapter.paragraphs.map((paragraph, index) => {
        const blockId = readerBlockIdForParagraph(chapter.id, index)
        const cCount = commentGutter?.countsByBlock[blockId] ?? 0
        const row = (
          <p
            key={`${chapter.id}-${index}`}
            data-search-paragraph={index}
            data-block-id={blockId}
            className={commentGutter ? 'min-w-0 flex-1' : undefined}
          >
            {renderParagraphContent(paragraph, prefs, highlightQuery)}
          </p>
        )
        if (!commentGutter) return row
        return (
          <div key={`${chapter.id}-${index}`} className="flex gap-1.5 sm:gap-2">
            <div className="flex w-7 shrink-0 flex-col items-center pt-1 sm:w-8">
              <button
                type="button"
                className={`reader-focus flex h-7 w-7 items-center justify-center rounded-lg border text-[10px] font-bold leading-none sm:h-8 sm:w-8 sm:text-xs ${
                  commentGutter.highlightBlockId === blockId ? 'ring-2 ring-[var(--reader-accent)] ring-offset-1 ring-offset-[var(--reader-bg)]' : ''
                }`}
                style={{
                  borderColor: 'var(--reader-border)',
                  backgroundColor:
                    cCount > 0
                      ? 'color-mix(in srgb, var(--reader-accent) 20%, var(--reader-panel))'
                      : 'var(--reader-panel)',
                  color: 'var(--reader-text)',
                }}
                aria-label={cCount > 0 ? `${cCount} discussion note${cCount === 1 ? '' : 's'} on this paragraph` : 'Add discussion note on this paragraph'}
                onClick={() => commentGutter.onOpenThread(blockId)}
              >
                {cCount > 0 ? (cCount > 99 ? '99+' : cCount) : '+'}
              </button>
            </div>
            {row}
          </div>
        )
      })}
    </article>
  )
}
