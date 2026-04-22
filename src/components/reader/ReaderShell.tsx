'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReaderBody } from '@/components/reader/ReaderBody'
import { ReaderChapterEndNav } from '@/components/reader/ReaderChapterEndNav'
import { ReaderCommentPanel } from '@/components/reader/ReaderCommentPanel'
import { SettingsDrawer } from '@/components/reader/SettingsDrawer'
import { getReaderCommentDisplayName, setReaderCommentDisplayName } from '@/lib/reader/comment-identity'
import type { ReaderPublicationCommentDto } from '@/lib/reader/comments-server'
import { markReaderContentPaint } from '@/lib/reader/reader-performance'
import {
  defaultReaderPreferences,
  loadReaderBookmark,
  loadReaderPreferences,
  loadReaderProgress,
  readerCssVariables,
  saveReaderBookmark,
  saveReaderPreferences,
  saveReaderProgress,
} from '@/lib/reader/settings'
import { registerReaderServiceWorker } from '@/lib/reader/pwa'
import { mergeRemoteReadingStateIfNewer, syncRemoteReadingState } from '@/lib/reader/reading-state-sync'
import { findSearchHits } from '@/lib/reader/search-book'
import { rankSearchHitsByEmbedding } from '@/lib/reader/semantic-search'
import type { ReaderBookmark, ReaderPreferences, ReaderPublication, ReaderTheme } from '@/lib/reader/types'

type ReaderShellProps = {
  publication: ReaderPublication
  initialChapterId: string
  routeBase: string
}

type VoiceOption = {
  label: string
  value: string
}

const THEME_CYCLE: ReaderTheme[] = ['paper', 'sepia', 'night', 'midnight']

function formatWordCount(count: number): string {
  return `${count.toLocaleString()} words`
}

function formatSavedAt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return t.isContentEditable
}

/** Pick the paragraph block closest to the upper reading anchor (stable resume). */
function pickVisibleBlockAnchor(): { blockId: string; charOffset: number } | null {
  const nodes = document.querySelectorAll<HTMLElement>('[data-block-id]')
  if (!nodes.length) return null
  const anchorY = window.innerHeight * 0.22
  let best: { id: string; score: number } | null = null
  for (const el of nodes) {
    const r = el.getBoundingClientRect()
    if (r.bottom < -80 || r.top > window.innerHeight + 80) continue
    const id = el.dataset.blockId
    if (!id) continue
    const score = -Math.abs(r.top - anchorY)
    if (!best || score > best.score) best = { id, score }
  }
  return best ? { blockId: best.id, charOffset: 0 } : null
}

export function ReaderShell({ publication, initialChapterId, routeBase }: ReaderShellProps) {
  const router = useRouter()
  const [chapterId, setChapterId] = useState(initialChapterId)
  const [prefs, setPrefs] = useState<ReaderPreferences>(defaultReaderPreferences)
  const [mobile, setMobile] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [bookmark, setBookmark] = useState<ReaderBookmark | null>(null)
  const [flashMessage, setFlashMessage] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [searchActiveQuery, setSearchActiveQuery] = useState('')
  const [hitIndex, setHitIndex] = useState(0)
  const [tocOpen, setTocOpen] = useState(true)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [rankedSearchHits, setRankedSearchHits] = useState<ReturnType<typeof findSearchHits> | null>(null)
  const [chapterComments, setChapterComments] = useState<ReaderPublicationCommentDto[]>([])
  const [commentsAvailable, setCommentsAvailable] = useState<boolean | null>(null)
  const [commentPanelOpen, setCommentPanelOpen] = useState(false)
  const [commentPanelBlockId, setCommentPanelBlockId] = useState<string | null>(null)
  const [commentDisplayName, setCommentDisplayNameState] = useState('Reader')

  const pendingRestoreRef = useRef<number | null>(null)
  /** After chapter navigation, scroll to this bookmark (not generic progress). */
  const pendingBookmarkJumpRef = useRef<ReaderBookmark | null>(null)
  const autoNextLockRef = useRef('')
  const flashTimeoutRef = useRef<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const chapterSelectRef = useRef<HTMLSelectElement | null>(null)

  const chapters = publication.chapters
  const currentIndex = Math.max(
    0,
    chapters.findIndex((c) => c.id === chapterId),
  )
  const chapter = chapters[currentIndex] ?? chapters[0]
  const prevChapterId = currentIndex > 0 ? chapters[currentIndex - 1]?.id ?? '' : ''
  const nextChapterId = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1]?.id ?? '' : ''

  const lexicalHits = useMemo(() => findSearchHits(publication, searchActiveQuery), [publication, searchActiveQuery])

  useEffect(() => {
    setRankedSearchHits(null)
    const q = searchActiveQuery.trim()
    if (!q) return
    if (process.env.NEXT_PUBLIC_READER_SEMANTIC_SEARCH !== '1') return
    let cancelled = false
    const base = findSearchHits(publication, q)
    void rankSearchHitsByEmbedding(q, base, (h) => {
      const ch = publication.chapters.find((c) => c.id === h.chapterId)
      return ch?.paragraphs[h.paragraphIndex] ?? ''
    }).then((next) => {
      if (!cancelled) setRankedSearchHits(next)
    })
    return () => {
      cancelled = true
    }
  }, [publication, searchActiveQuery])

  const hits = rankedSearchHits ?? lexicalHits

  useEffect(() => {
    if (!chapters.length) return
    const idx = chapters.findIndex((c) => c.id === initialChapterId)
    if (idx >= 0) {
      setChapterId(initialChapterId)
      return
    }
    const firstId = chapters[0]?.id
    if (!firstId) return
    setChapterId(firstId)
    router.replace(`${routeBase}/read/${publication.id}/${firstId}`, { scroll: false })
  }, [chapters, initialChapterId, publication.id, routeBase, router])

  useEffect(() => {
    const loaded = loadReaderPreferences()
    setPrefs({
      ...defaultReaderPreferences,
      ...loaded,
      uiMode: loaded.uiMode ?? defaultReaderPreferences.uiMode,
      focusBandEnabled: loaded.focusBandEnabled ?? defaultReaderPreferences.focusBandEnabled,
    })
    setBookmark(loadReaderBookmark(publication.id))
  }, [publication.id])

  useEffect(() => {
    saveReaderPreferences(prefs)
  }, [prefs])

  useEffect(() => {
    registerReaderServiceWorker()
  }, [])

  useEffect(() => {
    void mergeRemoteReadingStateIfNewer(publication.id, chapterId)
  }, [publication.id, chapterId])

  useEffect(() => {
    if (prefs.uiMode === 'study' && !mobile) setTocOpen(true)
  }, [prefs.uiMode, mobile])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMedia = () => setMobile(media.matches)
    const syncMotion = () => setPrefersReducedMotion(motion.matches)

    syncMedia()
    syncMotion()

    media.addEventListener('change', syncMedia)
    motion.addEventListener('change', syncMotion)
    return () => {
      media.removeEventListener('change', syncMedia)
      motion.removeEventListener('change', syncMotion)
    }
  }, [])

  useEffect(() => {
    if (!mobile) return
    setPrefs((current) => (current.panelOpen ? { ...current, panelOpen: false } : current))
  }, [mobile])

  useEffect(() => {
    if (!mobile || !mobileSearchOpen) return
    const id = window.requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [mobile, mobileSearchOpen])

  useEffect(() => {
    setCommentDisplayNameState(getReaderCommentDisplayName())
  }, [])

  const loadChapterComments = useCallback(async () => {
    if (!chapter) return
    const res = await fetch(
      `/api/reader/comments?publicationId=${encodeURIComponent(publication.id)}&chapterId=${encodeURIComponent(chapter.id)}`,
      { cache: 'no-store' },
    )
    if (res.status === 503) {
      setCommentsAvailable(false)
      setChapterComments([])
      return
    }
    if (!res.ok) {
      setCommentsAvailable(false)
      setChapterComments([])
      return
    }
    setCommentsAvailable(true)
    const data = (await res.json()) as { comments?: ReaderPublicationCommentDto[] }
    setChapterComments(data.comments ?? [])
  }, [chapter, publication.id])

  useEffect(() => {
    void loadChapterComments()
  }, [loadChapterComments])

  const commentCountsByBlock = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of chapterComments) {
      m[c.blockId] = (m[c.blockId] ?? 0) + 1
    }
    return m
  }, [chapterComments])

  const openCommentThread = useCallback((blockId: string) => {
    setCommentPanelBlockId(blockId)
    setCommentPanelOpen(true)
  }, [])

  const commentGutterProps = useMemo(() => {
    if (commentsAvailable !== true) return undefined
    return {
      countsByBlock: commentCountsByBlock,
      highlightBlockId: commentPanelOpen ? commentPanelBlockId : null,
      onOpenThread: openCommentThread,
    }
  }, [commentsAvailable, commentCountsByBlock, commentPanelOpen, commentPanelBlockId, openCommentThread])

  useEffect(() => {
    if (!mobile || !prefs.panelOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobile, prefs.panelOpen])

  useEffect(() => {
    const updateVoices = () => {
      const voices = window.speechSynthesis?.getVoices?.() ?? []
      setVoiceOptions(
        voices.map((voice) => ({
          label: `${voice.name} (${voice.lang})`,
          value: voice.voiceURI,
        })),
      )
    }

    updateVoices()
    window.speechSynthesis?.addEventListener?.('voiceschanged', updateVoices)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', updateVoices)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!chapter) {
        pendingRestoreRef.current = null
        return
      }

      const bmJump = pendingBookmarkJumpRef.current
      if (bmJump && bmJump.chapterId === chapter.id) {
        pendingBookmarkJumpRef.current = null
        pendingRestoreRef.current = null
        if (bmJump.blockId) {
          const el = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(bmJump.blockId)}"]`)
          if (el) {
            el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion ? 'auto' : 'smooth' })
            markReaderContentPaint()
            return
          }
        }
        window.scrollTo({ top: bmJump.scrollY, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
        markReaderContentPaint()
        return
      }

      const pending = pendingRestoreRef.current
      const loaded = typeof pending === 'number' ? null : loadReaderProgress(publication.id, chapter.id)
      const scrollFallback = typeof pending === 'number' ? pending : (loaded?.scrollY ?? 0)

      if (loaded?.blockId) {
        const el = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(loaded.blockId)}"]`)
        if (el) {
          el.scrollIntoView({ block: 'start', behavior: 'auto' })
          markReaderContentPaint()
          pendingRestoreRef.current = null
          return
        }
      }
      window.scrollTo({ top: scrollFallback, behavior: 'auto' })
      markReaderContentPaint()
      pendingRestoreRef.current = null
    }, 40)

    return () => window.clearTimeout(timer)
  }, [publication.id, chapter, prefersReducedMotion])

  useEffect(() => {
    if (!hits.length) {
      if (hitIndex !== 0) setHitIndex(0)
      return
    }
    const safeIdx = Math.min(hitIndex, hits.length - 1)
    if (safeIdx !== hitIndex) setHitIndex(safeIdx)
  }, [hits.length, hitIndex])

  useEffect(() => {
    if (!hits.length || !chapter) return
    const hit = hits[Math.min(hitIndex, hits.length - 1)]
    if (!hit || hit.chapterId !== chapter.id) return

    const id = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-search-paragraph="${hit.paragraphIndex}"]`)
      el?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [hitIndex, chapter, hits, prefersReducedMotion])

  const showFlash = useCallback((message: string) => {
    setFlashMessage(message)
    if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current)
    flashTimeoutRef.current = window.setTimeout(() => setFlashMessage(''), 2200)
  }, [])

  useEffect(
    () => () => {
      if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current)
    },
    [],
  )

  const goToChapter = useCallback(
    (nextChapterId: string, scrollY = 0) => {
      if (!nextChapterId || !chapter || nextChapterId === chapter.id) {
        pendingRestoreRef.current = scrollY
        window.scrollTo({ top: scrollY, behavior: 'auto' })
        return
      }

      pendingRestoreRef.current = scrollY
      window.speechSynthesis?.cancel()
      setIsSpeaking(false)
      setChapterId(nextChapterId)
      router.replace(`${routeBase}/read/${publication.id}/${nextChapterId}`, { scroll: false })
    },
    [chapter, publication.id, routeBase, router],
  )

  const saveCurrentProgress = useCallback(() => {
    if (!chapter) return
    const anchor = pickVisibleBlockAnchor()
    saveReaderProgress(publication.id, chapter.id, window.scrollY, anchor ?? undefined)
    void syncRemoteReadingState(publication.id, chapter.id, window.scrollY, anchor ?? undefined)
  }, [publication.id, chapter])

  useEffect(() => {
    let throttle: number | null = null

    const maybeAutoNext = () => {
      if (!chapter || !prefs.autoNextChapter || !nextChapterId) return
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24
      if (!nearBottom || autoNextLockRef.current === chapter.id) return
      autoNextLockRef.current = chapter.id
      window.setTimeout(() => {
        if (nextChapterId) goToChapter(nextChapterId)
      }, 220)
    }

    const onScroll = () => {
      maybeAutoNext()
      if (throttle !== null) return
      throttle = window.setTimeout(() => {
        saveCurrentProgress()
        throttle = null
      }, 180)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveCurrentProgress()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('beforeunload', saveCurrentProgress)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (throttle !== null) window.clearTimeout(throttle)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('beforeunload', saveCurrentProgress)
      document.removeEventListener('visibilitychange', onVisibility)
      saveCurrentProgress()
    }
  }, [chapter, goToChapter, nextChapterId, prefs.autoNextChapter, publication.id, saveCurrentProgress])

  useEffect(() => {
    if (!prefs.autoScrollEnabled || prefersReducedMotion) return
    const id = window.setInterval(() => {
      window.scrollBy(0, prefs.autoScrollSpeed)
    }, 24)
    return () => window.clearInterval(id)
  }, [prefs.autoScrollEnabled, prefs.autoScrollSpeed, prefersReducedMotion])

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
  }, [])

  const updatePref = useCallback(<K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) => {
    setPrefs((current) => ({ ...current, [key]: value }))
  }, [])

  const cycleTheme = useCallback(() => {
    const idx = Math.max(0, THEME_CYCLE.indexOf(prefs.theme))
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length] ?? prefs.theme
    updatePref('theme', next)
  }, [prefs.theme, updatePref])

  const runFind = useCallback(() => {
    const q = searchDraft.trim()
    setSearchActiveQuery(q)
    const nextHits = findSearchHits(publication, q)
    setHitIndex(0)
    const first = nextHits[0]
    if (first && first.chapterId !== chapterId) {
      goToChapter(first.chapterId, 0)
    }
  }, [searchDraft, publication, chapterId, goToChapter])

  const nextHit = useCallback(() => {
    if (!hits.length) return
    const next = (hitIndex + 1) % hits.length
    setHitIndex(next)
    const h = hits[next]
    if (!h) return
    if (h.chapterId !== chapterId) {
      goToChapter(h.chapterId, 0)
    }
  }, [hits, hitIndex, chapterId, goToChapter])

  const prevHit = useCallback(() => {
    if (!hits.length) return
    const prev = (hitIndex - 1 + hits.length) % hits.length
    setHitIndex(prev)
    const h = hits[prev]
    if (!h) return
    if (h.chapterId !== chapterId) {
      goToChapter(h.chapterId, 0)
    }
  }, [hits, hitIndex, chapterId, goToChapter])

  const clearSearch = useCallback(() => {
    setSearchDraft('')
    setSearchActiveQuery('')
    setHitIndex(0)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const typing = isEditableTarget(e.target)

      if (e.key === '/' && !typing) {
        e.preventDefault()
        if (mobile) setMobileSearchOpen(true)
        searchInputRef.current?.focus()
        return
      }

      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur()
        if (mobile) setMobileSearchOpen(false)
        return
      }

      if (typing && document.activeElement !== searchInputRef.current) return

      if (typing && document.activeElement === searchInputRef.current && e.key !== 'Escape') {
        if (e.key === 'Enter') {
          e.preventDefault()
          runFind()
        }
        return
      }

      if (typing) return

      if (e.key === 'n' && hits.length > 0) {
        e.preventDefault()
        nextHit()
        return
      }

      if (e.key === 'N' && hits.length > 0) {
        e.preventDefault()
        prevHit()
        return
      }

      if (e.key === '[' && prevChapterId) {
        e.preventDefault()
        goToChapter(prevChapterId)
        return
      }

      if (e.key === ']' && nextChapterId) {
        e.preventDefault()
        goToChapter(nextChapterId)
        return
      }

      if (e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        chapterSelectRef.current?.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goToChapter, hits.length, mobile, nextChapterId, nextHit, prevChapterId, prevHit, runFind])

  const handleReset = useCallback(() => {
    setPrefs({ ...defaultReaderPreferences, panelOpen: mobile ? false : true })
  }, [mobile])

  const handleSaveBookmark = useCallback(() => {
    if (!chapter) return
    const anchor = pickVisibleBlockAnchor()
    const next: ReaderBookmark = {
      chapterId: chapter.id,
      scrollY: window.scrollY,
      savedAt: new Date().toISOString(),
      schemaVersion: 2,
      ...(anchor ? { blockId: anchor.blockId, charOffset: anchor.charOffset } : {}),
    }
    saveReaderBookmark(publication.id, next.chapterId, next.scrollY, anchor ?? undefined)
    setBookmark(next)
    showFlash('Saved bookmark')
  }, [chapter, publication.id, showFlash])

  const handleJumpToBookmark = useCallback(() => {
    if (!bookmark || !chapter) return
    if (bookmark.chapterId === chapter.id) {
      if (bookmark.blockId) {
        const el = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(bookmark.blockId)}"]`)
        el?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion ? 'auto' : 'smooth' })
      } else {
        window.scrollTo({ top: bookmark.scrollY, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
      }
      showFlash(`Jumped to bookmark from ${formatSavedAt(bookmark.savedAt)}`)
      return
    }
    pendingBookmarkJumpRef.current = bookmark
    goToChapter(bookmark.chapterId)
    showFlash(`Jumped to bookmark from ${formatSavedAt(bookmark.savedAt)}`)
  }, [bookmark, chapter, goToChapter, prefersReducedMotion, showFlash])

  const toggleSpeak = useCallback(() => {
    if (!window.speechSynthesis || !chapter) return
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(chapter.paragraphs.join('\n\n'))
    const selectedVoice = window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === prefs.voiceURI)
    if (selectedVoice) utterance.voice = selectedVoice
    utterance.rate = prefs.ttsRate
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [chapter, prefs.ttsRate, prefs.voiceURI])

  const cssVars = useMemo(() => readerCssVariables(prefs), [prefs])
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < chapters.length - 1
  const hitLabel = hits.length ? `${Math.min(hitIndex + 1, hits.length)}/${hits.length}` : '0/0'

  if (!chapter) {
    return (
      <section className="e-reader-chrome-muted p-8 text-center text-sm">
        <p>This publication has no chapters.</p>
      </section>
    )
  }

  return (
    <section style={cssVars} className="notebook-line-paper pb-safe" data-reader-ui={prefs.uiMode}>
      <div
        className="sticky top-0 z-30 mb-3 rounded-2xl border px-2 py-3 shadow-sm sm:mb-4 sm:rounded-3xl sm:py-4 md:mb-5 md:px-6"
        style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
      >
        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-center gap-2">
            <Link
              href={routeBase}
              className="reader-focus shrink-0 rounded-xl px-2.5 py-2 text-sm font-semibold"
              style={{ color: 'var(--ink-accent)' }}
            >
              ← Library
            </Link>
            <span
              className="min-w-0 flex-1 truncate text-center text-xs font-medium leading-tight"
              style={{ color: 'var(--ink-text)' }}
              title={publication.title}
            >
              {publication.title}
            </span>
            <button
              type="button"
              onClick={cycleTheme}
              className="e-reader-chrome-chip reader-focus shrink-0 rounded-xl px-3 py-2 text-xs font-semibold"
              title="Cycle color theme"
            >
              Aa
            </button>
            <button
              type="button"
              onClick={() => setMobileSearchOpen((o) => !o)}
              className={`reader-focus shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold ${
                mobileSearchOpen ? 'e-reader-chrome-action border-transparent' : 'e-reader-chrome-chip'
              }`}
              aria-expanded={mobileSearchOpen}
            >
              {mobileSearchOpen ? 'Done' : 'Search'}
            </button>
          </div>
          {flashMessage ? (
            <p className="text-center text-xs font-medium" style={{ color: 'var(--ink-accent)' }}>
              {flashMessage}
            </p>
          ) : null}
        </div>

        {mobile ? (
          <label className="sr-only">
            <span>Choose chapter</span>
            <select
              ref={chapterSelectRef}
              value={chapter.id}
              onChange={(event) => goToChapter(event.target.value)}
            >
              {chapters.map((item, index) => (
                <option key={item.id} value={item.id}>
                  {index + 1}. {item.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="e-reader-chrome-muted mb-3 hidden flex-wrap items-center justify-between gap-3 text-sm md:flex">
          <nav className="flex flex-wrap items-center gap-2" aria-label="Breadcrumb">
            <Link href="/" className="reader-focus rounded-md hover:underline">
              Home
            </Link>
            <span aria-hidden>/</span>
            <Link href={routeBase} className="reader-focus rounded-md hover:underline">
              Reader
            </Link>
            <span aria-hidden>/</span>
            <Link
              href={`${routeBase}/read/${publication.id}/${chapter.id}`}
              className="reader-focus max-w-56 truncate rounded-md hover:underline md:max-w-72"
            >
              {publication.title}
            </Link>
            <span aria-hidden>/</span>
            <span className="max-w-56 truncate md:max-w-72" title={chapter.title}>
              {chapter.title}
            </span>
          </nav>
          {flashMessage ? (
            <span className="rounded-full px-3 py-1 text-xs" style={{ backgroundColor: 'var(--ink-bg)', color: 'var(--ink-accent)' }}>
              {flashMessage}
            </span>
          ) : null}
        </div>

        <div className="mb-4 hidden flex-col gap-4 lg:flex-row lg:items-start lg:justify-between md:flex">
          <div className="max-w-3xl">
            <p className="mb-1 text-sm font-semibold" style={{ color: 'var(--ink-accent)' }}>
              {publication.title}
            </p>
            <h1 className="text-2xl font-semibold md:text-3xl">{chapter.title}</h1>
            <p className="e-reader-chrome-muted mt-1 text-sm">
              Chapter {currentIndex + 1} of {chapters.length} · {formatWordCount(chapter.wordCount)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            <button
              type="button"
              onClick={() => setTocOpen((v) => !v)}
              className="e-reader-chrome-chip reader-focus rounded-2xl px-4 py-2 text-sm font-medium"
              aria-pressed={tocOpen}
            >
              {tocOpen ? 'Hide contents' : 'Contents'}
            </button>
            <button type="button" onClick={cycleTheme} className="e-reader-chrome-chip reader-focus rounded-2xl px-4 py-2 text-sm font-medium" title="Cycle theme">
              Theme
            </button>
            <button
              type="button"
              onClick={() => updatePref('panelOpen', !prefs.panelOpen)}
              className="e-reader-chrome-action reader-focus rounded-2xl px-4 py-2 text-sm font-medium"
            >
              {prefs.panelOpen ? 'Hide settings' : 'Open settings'}
            </button>
          </div>
        </div>

        {mobile && !mobileSearchOpen ? null : (
          <div
            className="mb-3 flex flex-col gap-2 rounded-2xl border px-3 py-3 md:mb-4 md:flex-row md:flex-wrap md:items-center"
            style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)' }}
          >
            <label className="min-w-0 flex-1 md:min-w-[200px]">
              <span className="sr-only">Search in book</span>
              <input
                ref={searchInputRef}
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    runFind()
                  }
                }}
                placeholder="Search in book…"
                className="e-reader-chrome-input reader-focus w-full rounded-xl border px-3 py-2 text-sm"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={runFind} className="e-reader-chrome-action reader-focus rounded-xl px-3 py-2 text-sm font-medium">
                Find
              </button>
              <button type="button" onClick={prevHit} disabled={!hits.length} className="e-reader-chrome-chip reader-focus rounded-xl px-3 py-2 text-sm disabled:opacity-40">
                Prev
              </button>
              <button type="button" onClick={nextHit} disabled={!hits.length} className="e-reader-chrome-chip reader-focus rounded-xl px-3 py-2 text-sm disabled:opacity-40">
                Next
              </button>
              <button type="button" onClick={clearSearch} className="e-reader-chrome-chip reader-focus rounded-xl px-3 py-2 text-sm">
                Clear
              </button>
              <span className="e-reader-chrome-muted flex items-center px-2 text-xs" aria-live="polite">
                {hitLabel}
              </span>
            </div>
          </div>
        )}

        <p className="e-reader-chrome-muted mb-3 hidden text-xs md:block">
          Shortcuts: / focus search · Enter find · n / Shift+n next/prev match · [ ] prev/next chapter · g chapter menu
        </p>

        {!mobile ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              type="button"
              onClick={() => prevChapterId && goToChapter(prevChapterId)}
              disabled={!canGoPrev}
              className="e-reader-chrome-action reader-focus rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <label className="flex-1">
              <span className="sr-only">Choose chapter</span>
              <select
                ref={chapterSelectRef}
                className="e-reader-chrome-input reader-focus w-full rounded-2xl border px-4 py-3 text-sm"
                value={chapter.id}
                onChange={(event) => goToChapter(event.target.value)}
              >
                {chapters.map((item, index) => (
                  <option key={item.id} value={item.id}>
                    {index + 1}. {item.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => nextChapterId && goToChapter(nextChapterId)}
              disabled={!canGoNext}
              className="e-reader-chrome-action reader-focus rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex items-start gap-3 md:gap-6">
        {!mobile && tocOpen ? (
          <nav
            className="e-reader-chrome-panel e-reader-chrome-scrollbar sticky top-24 z-10 hidden max-h-[70vh] w-52 shrink-0 overflow-y-auto rounded-3xl p-4 lg:block"
            aria-label="Table of contents"
          >
            <p className="e-reader-chrome-muted mb-3 text-xs font-semibold uppercase tracking-[0.2em]">Contents</p>
            <ul className="space-y-1">
              {chapters.map((c, index) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => goToChapter(c.id)}
                    className="reader-focus w-full rounded-xl px-3 py-2 text-left text-sm leading-snug transition-colors"
                    style={{
                      backgroundColor: c.id === chapter.id ? 'color-mix(in srgb, var(--ink-accent) 18%, var(--ink-paper))' : 'transparent',
                      color: 'var(--ink-text)',
                      border: c.id === chapter.id ? '1px solid var(--ink-accent)' : '1px solid transparent',
                    }}
                  >
                    <span className="e-reader-chrome-muted">{index + 1}. </span>
                    <span className="line-clamp-3">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="min-w-0 flex-1">
          {prefersReducedMotion && prefs.autoScrollEnabled ? (
            <div className="e-reader-chrome-muted mb-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)' }}>
              Auto scroll is paused because reduced motion is enabled on this device.
            </div>
          ) : null}

          <div className="reader-surface px-2 py-6 sm:px-4 md:px-8 md:py-10">
            {mobile ? (
              <header className="mb-6 border-b pb-6" style={{ borderColor: 'var(--reader-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-[1.35rem] font-semibold leading-snug sm:text-2xl" style={{ color: 'var(--reader-text)' }}>
                      {chapter.title}
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: 'var(--reader-muted)' }}>
                      Chapter {currentIndex + 1} of {chapters.length} · {formatWordCount(chapter.wordCount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePref('panelOpen', true)}
                    className="reader-focus mt-0.5 shrink-0 rounded-xl border p-2.5"
                    style={{
                      borderColor: 'var(--reader-border)',
                      backgroundColor: 'var(--reader-panel)',
                      color: 'var(--reader-text)',
                    }}
                    aria-label="Reader settings — typography, theme, TTS (Text-To-Speech), and more"
                    title="Reader settings"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                  </button>
                </div>
              </header>
            ) : null}
            {mobile ? (
              <div className="mb-8">
                <ReaderChapterEndNav
                  chapters={chapters}
                  chapterId={chapter.id}
                  currentIndex={currentIndex}
                  canGoPrev={canGoPrev}
                  canGoNext={canGoNext}
                  onGoToChapter={(id) => goToChapter(id)}
                  readerThemeVars={cssVars}
                />
              </div>
            ) : null}
            <ReaderBody
              chapter={chapter}
              prefs={prefs}
              highlightQuery={searchActiveQuery}
              focusBand={prefs.focusBandEnabled}
              {...(commentGutterProps ? { commentGutter: commentGutterProps } : {})}
            />
          </div>
        </div>

        {!mobile && prefs.panelOpen ? (
          <SettingsDrawer
            open={prefs.panelOpen}
            mobile={false}
            prefs={prefs}
            voiceOptions={voiceOptions}
            isSpeaking={isSpeaking}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onClose={() => updatePref('panelOpen', false)}
            onChange={updatePref}
            onGoPrev={() => prevChapterId && goToChapter(prevChapterId)}
            onGoNext={() => nextChapterId && goToChapter(nextChapterId)}
            onSaveBookmark={handleSaveBookmark}
            onJumpToBookmark={handleJumpToBookmark}
            hasBookmark={Boolean(bookmark)}
            onToggleSpeak={toggleSpeak}
            onReset={handleReset}
            commentsEnabled={commentsAvailable === true}
            commentDisplayName={commentDisplayName}
            onCommentDisplayNameChange={(v) => {
              setCommentDisplayNameState(v)
              setReaderCommentDisplayName(v)
            }}
          />
        ) : null}
      </div>

      {mobile && prefs.panelOpen ? (
        <SettingsDrawer
          open={prefs.panelOpen}
          mobile
          prefs={prefs}
          voiceOptions={voiceOptions}
          isSpeaking={isSpeaking}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onClose={() => updatePref('panelOpen', false)}
          onChange={updatePref}
          onGoPrev={() => prevChapterId && goToChapter(prevChapterId)}
          onGoNext={() => nextChapterId && goToChapter(nextChapterId)}
          onSaveBookmark={handleSaveBookmark}
          onJumpToBookmark={handleJumpToBookmark}
          hasBookmark={Boolean(bookmark)}
          onToggleSpeak={toggleSpeak}
          onReset={handleReset}
          commentsEnabled={commentsAvailable === true}
          commentDisplayName={commentDisplayName}
          onCommentDisplayNameChange={(v) => {
            setCommentDisplayNameState(v)
            setReaderCommentDisplayName(v)
          }}
        />
      ) : null}

      <ReaderCommentPanel
        open={commentPanelOpen}
        mobile={mobile}
        publicationId={publication.id}
        chapterId={chapter.id}
        blockId={commentPanelBlockId}
        chapterTitle={chapter.title}
        comments={chapterComments}
        onClose={() => {
          setCommentPanelOpen(false)
          setCommentPanelBlockId(null)
        }}
        onPosted={() => void loadChapterComments()}
      />
    </section>
  )
}
