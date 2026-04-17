'use client'

import { Fragment, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { ReaderChapter, ReaderPreferences } from '@/lib/reader/types'
import { escapeRegex } from '@/lib/reader/search-book'

type ReaderBodyProps = {
  chapter: ReaderChapter
  prefs: ReaderPreferences
  /** When set, all case-insensitive occurrences are wrapped in `<mark>` (still combines with bionic outside matches). */
  highlightQuery?: string
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

export function ReaderBody({ chapter, prefs, highlightQuery = '' }: ReaderBodyProps) {
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
      style={proseStyle}
      aria-label={`${chapter.title} reading text`}
    >
      {chapter.paragraphs.map((paragraph, index) => (
        <p key={`${chapter.id}-${index}`} data-search-paragraph={index}>
          {renderParagraphContent(paragraph, prefs, highlightQuery)}
        </p>
      ))}
    </article>
  )
}
