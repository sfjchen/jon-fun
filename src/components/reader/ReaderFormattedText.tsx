'use client'

import { Fragment, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ReaderBlock, ReaderPreferences } from '@/lib/reader/types'
import { escapeRegex } from '@/lib/reader/search-book'

export function safeReaderHref(href: string): string | undefined {
  return /^(https?:\/\/|mailto:|#[\w-]+$|\/games\/e-reader\/read\/)/i.test(href) ? href : undefined
}

export function isReaderImageSource(src: string): boolean {
  return /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(src)
}

function bionicText(text: string): ReactNode {
  return text.split(/(\s+)/).map((word, i) => {
    if (!word.trim()) return word
    const split = Math.max(1, Math.ceil(word.length * 0.45))
    return (
      <Fragment key={i}>
        <strong>{word.slice(0, split)}</strong>
        {word.slice(split)}
      </Fragment>
    )
  })
}

/** Slice source formatting at the same offsets used by search and annotation anchors. */
export function formattedReaderText(
  text: string,
  block: ReaderBlock | undefined,
  prefs: ReaderPreferences,
  query: string,
  start = 0,
  end = text.length,
  useBionic = true,
): ReactNode {
  const runs = block?.runs?.map((run) => run.text).join('') === text ? block.runs : [{ text }]
  const matches = query.trim()
    ? [...text.matchAll(new RegExp(escapeRegex(query.trim()), 'gi'))].map((m) => ({
        start: m.index,
        end: m.index + m[0].length,
      }))
    : []
  let offset = 0
  return runs?.map((run, i) => {
    const runStart = offset
    offset += run.text.length
    const a = Math.max(start, runStart)
    const b = Math.min(end, offset)
    if (a >= b) return null
    const cuts = [...new Set([a, b, ...matches.flatMap((m) => [m.start, m.end]).filter((p) => p > a && p < b)])].sort(
      (x, y) => x - y,
    )
    let content: ReactNode = cuts.slice(0, -1).map((point, j) => {
      const piece = text.slice(point, cuts[j + 1])
      return matches.some((m) => m.start <= point && m.end > point) ? (
        <mark key={j} className="reader-search-match">
          {piece}
        </mark>
      ) : (
        <Fragment key={j}>{useBionic && prefs.bionic ? bionicText(piece) : piece}</Fragment>
      )
    })
    if (run.italic) content = <em>{content}</em>
    if (run.bold) content = <strong>{content}</strong>
    if (run.superscript) content = <sup>{content}</sup>
    if (run.subscript) content = <sub>{content}</sub>
    const href = run.href ? safeReaderHref(run.href) : undefined
    if (href)
      content = (
        <a href={href} rel="noopener noreferrer">
          {content}
        </a>
      )
    return (
      <span key={i} id={a === runStart ? run.anchorId : undefined}>
        {content}
      </span>
    )
  })
}

export function ReaderIllustration({ block }: { block: ReaderBlock }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const image = block.image
  if (!image || !isReaderImageSource(image.src)) return null
  return (
    <figure className="reader-illustration" id={block.anchorId}>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={`Enlarge illustration: ${image.alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Embedded EPUB raster, no remote image request. */}
        <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
      </button>
      <dialog
        ref={dialog}
        className="reader-image-dialog"
        aria-label={image.alt}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close()
        }}
      >
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close illustration">
          Close ×
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- Original EPUB illustration for zooming. */}
        <img src={image.src} alt={image.alt} />
      </dialog>
    </figure>
  )
}
