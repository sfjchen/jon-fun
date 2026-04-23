'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { readerBlockIdForParagraph } from '@/lib/reader/blocks'
import type { ChapterAnnotationBundle, CommentAnchor, ReaderCommentThread } from '@/lib/reader/chapter-annotations'
import { buildTextSegments } from '@/lib/reader/annotation-segments'
import { normalizeParagraphText, resolveQuoteInParagraph } from '@/lib/reader/chapter-annotations'
import type { ReaderChapter, ReaderPreferences } from '@/lib/reader/types'
import { escapeRegex } from '@/lib/reader/search-book'
import { getTextOffsetInElement, wordRangeInParagraph } from '@/lib/reader/reader-gestures'

type LegacyCommentGutter = {
  countsByBlock: Record<string, number>
  highlightBlockId: string | null
  onOpenThread: (blockId: string) => void
}

export type ReaderInContextHandlers = {
  bundle: ChapterAnnotationBundle
  expandedKey: string | null
  onExpand: (key: string | null) => void
  activeTool: 'none' | 'comment' | 'highlight' | 'pen'
  composer: { anchor: CommentAnchor; draft: string } | null
  onOpenComposer: (anchor: CommentAnchor) => void
  onComposerDraft: (d: string) => void
  onComposerSubmit: () => void
  onComposerCancel: () => void
  onAddHighlight: (blockId: string, start: number, end: number) => void
  onToggleWordHighlight: (blockId: string, start: number, end: number) => void
  onRangeForComment: (blockId: string, start: number, end: number) => void
  onNewThread: (anchor: CommentAnchor, body: string) => void
  onPostMessage: (threadId: string, body: string) => void
  /** Single tap: toggle expand if gap has threads. */
  onGapRowClick: (afterParagraphIndex: number) => void
  /** Double-tap/click: always add a note in this gap. */
  onGapDoubleOpen: (afterParagraphIndex: number) => void
}

type ReaderBodyProps = {
  chapter: ReaderChapter
  prefs: ReaderPreferences
  highlightQuery?: string
  focusBand?: boolean
  commentGutter?: LegacyCommentGutter
  inContext?: ReaderInContextHandlers
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

function renderBionicInToken(word: string) {
  if (!word.trim()) return word
  const { lead, tail } = bionicSplit(word)
  return (
    <>
      <strong>{lead}</strong>
      {tail}
    </>
  )
}

function renderBionicParagraphText(paragraph: string) {
  return paragraph.split(/(\s+)/).map((token, tokenIndex) => {
    if (!token.trim()) return <Fragment key={tokenIndex}>{token}</Fragment>
    return <span key={tokenIndex}>{renderBionicInToken(token)}</span>
  })
}

function renderSearchThenBionic(
  part: string,
  useBionic: boolean,
  highlightQuery: string,
  prefs: ReaderPreferences,
  isMatch: boolean,
  key: number,
): ReactNode {
  if (isMatch) {
    return (
      <mark key={key} className="reader-search-match">
        {part}
      </mark>
    )
  }
  return <Fragment key={key}>{useBionic && prefs.bionic ? renderBionicParagraphText(part) : part}</Fragment>
}

function renderParagraphContentLegacy(
  paragraph: string,
  prefs: ReaderPreferences,
  highlightQuery: string,
) {
  const q = highlightQuery.trim()
  if (!q) {
    return prefs.bionic ? renderBionicParagraphText(paragraph) : paragraph
  }
  const re = new RegExp(`(${escapeRegex(q)})`, 'gi')
  const parts = paragraph.split(re)
  return parts.map((part, i) => {
    if (part === '') return null
    const isMatch = i % 2 === 1
    return renderSearchThenBionic(part, true, highlightQuery, prefs, isMatch, i)
  })
}

const HL_CLASS: Record<string, string> = {
  yellow: 'reader-user-hl reader-user-hl-yellow',
  green: 'reader-user-hl reader-user-hl-green',
  blue: 'reader-user-hl reader-user-hl-blue',
}

function messagesInBlock(bundle: ChapterAnnotationBundle, blockId: string): number {
  return bundle.threads
    .filter((t) => t.anchor.kind === 'block' && t.anchor.blockId === blockId)
    .reduce((a, t) => a + t.messages.length, 0)
}

function blockThreads(bundle: ChapterAnnotationBundle, blockId: string): ReaderCommentThread[] {
  return bundle.threads.filter((t) => t.anchor.kind === 'block' && t.anchor.blockId === blockId)
}

function rangeThreadsInBlock(bundle: ChapterAnnotationBundle, blockId: string): ReaderCommentThread[] {
  return bundle.threads.filter((t) => t.anchor.kind === 'range' && t.anchor.blockId === blockId)
}

function gapMessageCount(bundle: ChapterAnnotationBundle, afterIdx: number): number {
  return bundle.threads
    .filter((t) => t.anchor.kind === 'gap' && t.anchor.afterParagraphIndex === afterIdx)
    .reduce((a, t) => a + t.messages.length, 0)
}

function ComposerBox({
  draft,
  onDraft,
  onSubmit,
  onCancel,
  placeholder,
}: {
  draft: string
  onDraft: (s: string) => void
  onSubmit: () => void
  onCancel: () => void
  placeholder: string
}) {
  return (
    <div
      className="reader-inline-composer reader-note-prose my-2 ml-1 rounded-lg border py-2 pl-4 pr-2"
      style={{ borderColor: 'var(--reader-border)', backgroundColor: 'var(--reader-panel)' }}
    >
      <textarea
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="reader-focus w-full resize-none bg-transparent leading-snug"
        style={{ color: 'var(--reader-text)' }}
      />
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          className="reader-focus rounded-lg px-2 py-1 text-xs font-semibold"
          style={{ background: 'var(--reader-accent)', color: 'var(--reader-bg, #fff)' }}
        >
          Post
        </button>
        <button type="button" onClick={onCancel} className="reader-focus rounded-lg px-2 py-1 text-xs">
          Cancel
        </button>
      </div>
    </div>
  )
}

function renderThreadCard(
  t: ReaderCommentThread,
  onPost: (threadId: string, body: string) => void,
  draft: string,
  onDraft: (d: string) => void,
) {
  return (
    <div key={t.id} className="reader-note-prose rounded-lg border py-2 pl-4 pr-2" style={{ borderColor: 'var(--reader-border)' }}>
      {t.messages.map((m) => (
        <p key={m.id} className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--reader-text)' }}>
          <span className="text-base font-semibold" style={{ color: 'var(--reader-accent)' }}>
            {m.authorDisplay}
          </span>
          {': '}
          {m.body}
        </p>
      ))}
      <label className="mt-2 block">
        <span className="sr-only">Reply</span>
        <input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              const v = draft.trim()
              if (v) onPost(t.id, v)
            }
          }}
          placeholder="Reply…"
          className="reader-focus w-full rounded border bg-transparent py-1.5"
          style={{ borderColor: 'var(--reader-border)' }}
        />
      </label>
    </div>
  )
}

/** Between paragraphs: no filled chrome when empty; optional dot if notes exist. Double-tap to add; if notes, single-tap to expand. */
function GapInterParagraphRow({
  gCount,
  onSingle,
  onDouble,
}: {
  gCount: number
  onSingle: () => void
  onDouble: () => void
}) {
  const clickTimerRef = useRef<number | null>(null)
  const lastPtrUp = useRef<{ t: number; x: number; y: number } | null>(null)

  const clearTimer = () => {
    if (clickTimerRef.current != null) {
      window.clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
  }

  return (
    <div
      className="reader-para-gap my-0.5 w-full"
      style={{ touchAction: 'manipulation' }}
    >
      <div
        role="separator"
        aria-label={gCount > 0 ? 'Between paragraphs — tap to show notes, double-tap to add' : 'Between paragraphs — double-tap to add a note'}
        className="flex min-h-2 w-full select-none items-center justify-center"
        onPointerUp={(e) => {
          if (e.button !== 0) return
          const pr = lastPtrUp.current
          const now = e.timeStamp
          if (pr && now - pr.t < 500 && Math.hypot(e.clientX - pr.x, e.clientY - pr.y) < 48) {
            lastPtrUp.current = null
            clearTimer()
            e.preventDefault()
            e.stopPropagation()
            onDouble()
            return
          }
          lastPtrUp.current = { t: now, x: e.clientX, y: e.clientY }
          clearTimer()
          clickTimerRef.current = window.setTimeout(() => {
            clickTimerRef.current = null
            lastPtrUp.current = null
            if (gCount > 0) onSingle()
          }, 360)
        }}
        onPointerCancel={() => {
          lastPtrUp.current = null
          clearTimer()
        }}
      >
        {gCount > 0 ? (
          <span className="min-h-4 text-lg leading-none opacity-40" style={{ color: 'var(--reader-muted)' }} aria-hidden>
            ·
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function ReaderBody({
  chapter,
  prefs,
  highlightQuery = '',
  focusBand = false,
  commentGutter,
  inContext,
}: ReaderBodyProps) {
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({})
  const lastParaDbl = useRef<Record<string, { t: number; x: number; y: number }>>({})

  const useBionic = inContext ? false : prefs.bionic
  const textAlign = prefs.textAlign
  const proseStyle = useMemo<CSSProperties>(
    () => ({
      textAlign,
      userSelect: prefs.copyEnabled && inContext?.activeTool !== 'pen' ? 'text' : 'none',
    }),
    [prefs.copyEnabled, textAlign, inContext?.activeTool],
  )

  const setRep = (id: string, t: string) => setReplyDraft((d) => ({ ...d, [id]: t }))

  /** Selection: highlight applies immediately; comment opens composer (parent). */
  useEffect(() => {
    if (!inContext) return
    const tool = inContext.activeTool
    if (tool !== 'comment' && tool !== 'highlight') return
    const onUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const a = sel.anchorNode
      if (!a) return
      const el = (
        a.nodeType === Node.TEXT_NODE ? a.parentElement?.closest?.('[data-block-id]') : (a as HTMLElement).closest?.('[data-block-id]')
      ) as HTMLElement | null
      if (!el?.dataset.blockId) return
      const blockId = el.dataset.blockId
      const r = sel.getRangeAt(0)
      const pre = r.cloneRange()
      pre.selectNodeContents(el)
      pre.setEnd(r.startContainer, r.startOffset)
      const start = pre.toString().length
      const end = start + r.toString().length
      if (end <= start) return
      if (tool === 'highlight') {
        inContext.onAddHighlight(blockId, start, end)
        sel.removeAllRanges()
        return
      }
      inContext.onRangeForComment(blockId, start, end)
      sel.removeAllRanges()
    }
    document.addEventListener('mouseup', onUp, true)
    return () => document.removeEventListener('mouseup', onUp, true)
  }, [inContext])

  if (inContext) {
    const b = inContext.bundle
    const {
      expandedKey,
      onExpand,
      composer,
      onComposerDraft,
      onComposerSubmit,
      onComposerCancel,
      onGapRowClick,
      onGapDoubleOpen,
    } = inContext
    const post = (id: string, body: string) => {
      inContext.onPostMessage(id, body)
      setReplyDraft((d) => ({ ...d, [id]: '' }))
    }

    return (
      <article
        className="reader-prose reader-annotation-article pb-16 reader-scrollbar"
        data-indent={prefs.textIndent}
        data-focus-band={focusBand ? 'on' : 'off'}
        style={proseStyle}
        aria-label={`${chapter.title} reading text`}
      >
        {chapter.paragraphs.map((paragraph, index) => {
          const blockId = readerBlockIdForParagraph(chapter.id, index)
          const ptext = normalizeParagraphText(paragraph)
          const hls = b.highlights.filter((h) => h.blockId === blockId)
          const rTs = rangeThreadsInBlock(b, blockId)
          const hlItems = hls
            .map((h) => {
              const pos = resolveQuoteInParagraph(ptext, h.quote) ?? { start: h.position.start, end: h.position.end }
              return { start: pos.start, end: pos.end, kind: 'h' as const, id: h.id }
            })
            .filter((x) => x.end > x.start)
          const cItems = rTs
            .map((t) => {
              if (t.anchor.kind !== 'range') return null
              const pos = resolveQuoteInParagraph(ptext, t.anchor.quote) ?? {
                start: t.anchor.position.start,
                end: t.anchor.position.end,
              }
              return { start: pos.start, end: pos.end, kind: 'c' as const, id: t.id }
            })
            .filter((x): x is { start: number; end: number; kind: 'c'; id: string } => x != null && x.end > x.start)
          const segs = buildTextSegments(ptext.length, [...hlItems, ...cItems])
          const bMsg = messagesInBlock(b, blockId)
          const bTs = blockThreads(b, blockId)
          const showBlock = expandedKey === `block:${blockId}`

          const gapAfterPrev = index > 0 ? index - 1 : -1
          const gCount = gapAfterPrev >= 0 ? gapMessageCount(b, gapAfterPrev) : 0
          const showGapComposer = composer?.anchor.kind === 'gap' && gapAfterPrev >= 0 && composer.anchor.afterParagraphIndex === gapAfterPrev

          const blockComposer =
            composer?.anchor.kind === 'block' && composer.anchor.blockId === blockId ? composer : null
          const rangeComposer =
            composer?.anchor.kind === 'range' && composer.anchor.blockId === blockId ? composer : null

          return (
            <Fragment key={`${chapter.id}-wrap-${index}`}>
              {index > 0 ? (
                <>
                  <GapInterParagraphRow
                    gCount={gCount}
                    onSingle={() => onGapRowClick(gapAfterPrev)}
                    onDouble={() => onGapDoubleOpen(gapAfterPrev)}
                  />
                  {showGapComposer ? (
                    <ComposerBox
                      draft={composer.draft}
                      onDraft={onComposerDraft}
                      onSubmit={onComposerSubmit}
                      onCancel={onComposerCancel}
                      placeholder="Note in this space…"
                    />
                  ) : null}
                  {expandedKey === `gap:${gapAfterPrev}` ? (
                    <div
                      className="reader-note-prose ml-1 space-y-3 border-l-2 pl-4"
                      style={{ borderColor: 'var(--reader-accent)' }}
                    >
                      {b.threads
                        .filter(
                          (t) => t.anchor.kind === 'gap' && t.anchor.afterParagraphIndex === gapAfterPrev,
                        )
                        .map((t) => (
                          <div key={t.id}>
                            {renderThreadCard(t, post, replyDraft[t.id] ?? '', (x) => setRep(t.id, x))}
                          </div>
                        ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              <p
                data-search-paragraph={index}
                data-block-id={blockId}
                className="min-w-0"
                style={{ touchAction: 'manipulation' }}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  window.getSelection()?.removeAllRanges()
                  const el = e.currentTarget
                  const off = getTextOffsetInElement(el, e.clientX, e.clientY)
                  if (off == null) return
                  const wr = wordRangeInParagraph(ptext, off)
                  if (wr) inContext.onToggleWordHighlight(blockId, wr.start, wr.end)
                  else inContext.onOpenComposer({ kind: 'block', blockId })
                }}
                onTouchEnd={(e) => {
                  if (e.touches.length > 0) return
                  const t = e.changedTouches[0]
                  if (!t) return
                  const k = blockId
                  const p = lastParaDbl.current[k]
                  const now = performance.now()
                  if (p && now - p.t < 520 && Math.hypot(t.clientX - p.x, t.clientY - p.y) < 36) {
                    delete lastParaDbl.current[k]
                    e.preventDefault()
                    window.getSelection()?.removeAllRanges()
                    const el = e.currentTarget
                    const off = getTextOffsetInElement(el, t.clientX, t.clientY)
                    if (off == null) return
                    const wr = wordRangeInParagraph(ptext, off)
                    if (wr) inContext.onToggleWordHighlight(blockId, wr.start, wr.end)
                    else inContext.onOpenComposer({ kind: 'block', blockId })
                    return
                  }
                  lastParaDbl.current[k] = { t: now, x: t.clientX, y: t.clientY }
                }}
              >
                {segs.map((seg, si) => {
                  const piece = ptext.slice(seg.start, seg.end)
                  if (!piece) return null
                  const hasHl = seg.layers.some((l) => l.kind === 'h')
                  const cLayer = seg.layers.find((l) => l.kind === 'c')
                  const q = highlightQuery.trim()
                  let inner: ReactNode
                  if (q) {
                    const re = new RegExp(`(${escapeRegex(q)})`, 'gi')
                    const parts = piece.split(re)
                    inner = parts.map((part, j) => {
                      if (part === '') return null
                      return renderSearchThenBionic(part, useBionic, highlightQuery, prefs, j % 2 === 1, j)
                    })
                  } else {
                    inner = useBionic && prefs.bionic ? renderBionicParagraphText(piece) : piece
                  }
                  if (hasHl) {
                    const id = seg.layers.find((l) => l.kind === 'h')?.id
                    const h = b.highlights.find((x) => x.id === id)
                    const cname = h ? HL_CLASS[h.color] ?? HL_CLASS.yellow : HL_CLASS.yellow
                    inner = <span className={cname}>{inner}</span>
                  }
                  if (cLayer) {
                    const th = rTs.find((t) => t.id === cLayer.id)
                    const mcount = th?.messages.length ?? 0
                    inner = (
                      <span className="border-b-2" style={{ borderColor: 'var(--reader-accent)' }}>
                        {inner}
                        {mcount > 0 ? (
                          <button
                            type="button"
                            className="reader-focus ms-0.5 inline-flex h-4 min-w-4 items-center align-super text-[9px] font-bold"
                            aria-label={`${mcount} note(s)`}
                            onClick={() => onExpand(expandedKey === `thread:${cLayer.id}` ? null : `thread:${cLayer.id}`)}
                          >
                            {mcount}
                          </button>
                        ) : null}
                      </span>
                    )
                  }
                  return <Fragment key={`p${index}-s${si}`}>{inner}</Fragment>
                })}
                {bMsg > 0 ? (
                  <button
                    type="button"
                    className="reader-focus reader-ann-eop ms-0.5 inline text-lg leading-none opacity-40"
                    style={{ color: 'var(--reader-muted)' }}
                    aria-label={showBlock ? 'Hide paragraph notes' : `Show ${bMsg} paragraph note(s)`}
                    onClick={() => onExpand(showBlock ? null : `block:${blockId}`)}
                  >
                    ·
                  </button>
                ) : null}
              </p>

              {rTs.map(
                (t) =>
                  expandedKey === `thread:${t.id}` ? (
                    <div
                      key={t.id}
                      className="reader-note-prose ml-1 border-l-2 pl-4"
                      style={{ borderColor: 'var(--reader-accent)' }}
                    >
                    {renderThreadCard(t, post, replyDraft[t.id] ?? '', (x) => setRep(t.id, x))}
                  </div>
                ) : null,
              )}

              {showBlock ? (
                <div className="reader-note-prose ml-1 space-y-3 border-l-2 pl-4" style={{ borderColor: 'var(--reader-accent)' }}>
                  {bTs.map((t) => (
                    <div key={t.id}>{renderThreadCard(t, post, replyDraft[t.id] ?? '', (x) => setRep(t.id, x))}</div>
                  ))}
                </div>
              ) : null}

              {blockComposer ? (
                <ComposerBox
                  draft={blockComposer.draft}
                  onDraft={onComposerDraft}
                  onSubmit={onComposerSubmit}
                  onCancel={onComposerCancel}
                  placeholder="Note on this paragraph…"
                />
              ) : null}
              {rangeComposer ? (
                <ComposerBox
                  draft={rangeComposer.draft}
                  onDraft={onComposerDraft}
                  onSubmit={onComposerSubmit}
                  onCancel={onComposerCancel}
                  placeholder="Note on this selection…"
                />
              ) : null}
            </Fragment>
          )
        })}

      </article>
    )
  }

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
          <p key={`${chapter.id}-${index}`} data-search-paragraph={index} data-block-id={blockId} className={commentGutter ? 'min-w-0 flex-1' : undefined}>
            {renderParagraphContentLegacy(paragraph, prefs, highlightQuery)}
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
