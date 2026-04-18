'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createEpubImportDraft, createImportDraft, mergeWithPreviousChapter, renameChapter, splitChapterAtMidpoint } from '@/lib/reader/text-chapters'
import { extractEpub } from '@/lib/reader/epub-extract'
import { extractPdfText } from '@/lib/reader/pdf-extract'
import { deleteReaderPublication, getReaderPublication, listReaderPublications, saveReaderPublication } from '@/lib/reader/publications'
import { loadLastReaderLocation } from '@/lib/reader/settings'
import { registerReaderServiceWorker } from '@/lib/reader/pwa'
import type { ReaderImportDraft, ReaderPublication, ReaderPublicationSummary, ReaderSourceType } from '@/lib/reader/types'

type ReaderStudioProps = {
  routeBase: string
}

function fileToText(file: File): Promise<string> {
  return file.text()
}

function sourceLabel(sourceType: ReaderSourceType): string {
  switch (sourceType) {
    case 'pdf':
      return 'PDF'
    case 'epub':
      return 'EPUB'
    case 'txt':
      return 'Text file'
    default:
      return 'Paste'
  }
}

function exportPublicationAsTxt(pub: ReaderPublication) {
  const body = pub.chapters
    .map((c) => {
      const head = `# ${c.title}`
      const paras = c.paragraphs.join('\n\n')
      return `${head}\n\n${paras}`
    })
    .join('\n\n\n')
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = pub.title.replace(/[<>:"/\\|?*]/g, '').trim().slice(0, 80) || 'book'
  a.download = `${safe}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ReaderStudio({ routeBase }: ReaderStudioProps) {
  const router = useRouter()
  const [library, setLibrary] = useState<ReaderPublicationSummary[]>([])
  const [importMode, setImportMode] = useState<'paste' | 'file'>('paste')
  const [title, setTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<ReaderImportDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastLocation, setLastLocation] = useState<{ bookId: string; chapterId: string } | null>(null)

  const loadLibrary = useCallback(async () => {
    const summaries = await listReaderPublications()
    setLibrary(summaries)
    setLastLocation(loadLastReaderLocation())
  }, [])

  useEffect(() => {
    void loadLibrary()
    void registerReaderServiceWorker()
  }, [loadLibrary])

  /** E2E (End-to-End): `?e2eUpload=1` opens file mode without relying on click timing (Playwright). */
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (new URLSearchParams(window.location.search).get('e2eUpload') === '1') {
        setImportMode('file')
      }
    } catch {
      /* ignore */
    }
  }, [])

  const parseImport = useCallback(async () => {
    setBusy(true)
    setError('')

    try {
      if (importMode === 'paste') {
        if (!pasteText.trim()) throw new Error('Paste some text first.')
        setDraft(
          createImportDraft({
            rawText: pasteText,
            sourceType: 'paste',
            title,
          }),
        )
        return
      }

      if (!selectedFile) throw new Error('Choose a .txt, .md, .pdf, or .epub file first.')

      const isPdf = selectedFile.type === 'application/pdf' || /\.pdf$/i.test(selectedFile.name)
      if (isPdf) {
        const extracted = await extractPdfText(selectedFile)
        setDraft(
          createImportDraft({
            rawText: extracted.text,
            sourceType: 'pdf',
            title,
            originalFileName: selectedFile.name,
            notes: extracted.notes,
          }),
        )
        return
      }

      const isEpub =
        /\.epub$/i.test(selectedFile.name) ||
        selectedFile.type === 'application/epub+zip' ||
        selectedFile.type === 'application/x-epub+zip'
      if (isEpub) {
        const extracted = await extractEpub(selectedFile)
        setDraft(
          createEpubImportDraft({
            packageTitle: extracted.packageTitle,
            spineChapters: extracted.chapters,
            title,
            originalFileName: selectedFile.name,
            notes: extracted.notes,
          }),
        )
        return
      }

      const text = await fileToText(selectedFile)
      setDraft(
        createImportDraft({
          rawText: text,
          sourceType: 'txt',
          title,
          originalFileName: selectedFile.name,
        }),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not import this file.')
    } finally {
      setBusy(false)
    }
  }, [importMode, pasteText, selectedFile, title])

  const saveDraft = useCallback(async () => {
    if (!draft || draft.chapters.length === 0) {
      setError('Import something with at least one chapter first.')
      return
    }

    const now = new Date().toISOString()
    const publication: ReaderPublication = {
      id: uuidv4(),
      title: draft.title.trim() || 'Untitled reader import',
      sourceType: draft.sourceType,
      chapters: draft.chapters.map((chapter, order) => ({ ...chapter, order })),
      createdAt: now,
      updatedAt: now,
      ...(draft.originalFileName != null && draft.originalFileName !== ''
        ? { originalFileName: draft.originalFileName }
        : {}),
      ...(draft.importNotes?.length ? { importNotes: draft.importNotes } : {}),
    }

    await saveReaderPublication(publication)
    await loadLibrary()
    setDraft(null)
    setPasteText('')
    setSelectedFile(null)
    setTitle('')
    router.push(`${routeBase}/read/${publication.id}/${publication.chapters[0]?.id ?? ''}`)
  }, [draft, loadLibrary, routeBase, router])

  const libraryCards = useMemo(
    () =>
      library.map((item) => {
        const resumeChapterId = lastLocation?.bookId === item.id ? lastLocation.chapterId : item.firstChapterId
        return {
          ...item,
          resumeHref: `${routeBase}/read/${item.id}/${resumeChapterId}`,
        }
      }),
    [lastLocation?.bookId, lastLocation?.chapterId, library, routeBase],
  )

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border p-5 md:p-6" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--ink-accent)' }}>NovelFire-style web reader</p>
            <h1 className="font-lora text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--ink-text)' }}>Import books into a local-first e-reader</h1>
            <p className="mt-2 max-w-3xl text-sm" style={{ color: 'var(--ink-muted)' }}>
              Paste plain text or upload `.txt` / `.md` on-device. PDF and EPUB are parsed once on the server (not stored) for reliable text; chapters follow PDF heuristics or the EPUB spine. DRM EPUBs are not supported. Saved books and progress stay in IndexedDB.
            </p>
          </div>
          <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-muted)' }}>
            PDFs are reflowed into paragraphs; EPUBs use spine order and plain text from XHTML. Complex layouts, images, and footnotes may need cleanup before saving.
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setImportMode('paste')}
                className="rounded-full border px-4 py-2 text-sm font-medium"
                style={{
                  borderColor: importMode === 'paste' ? 'var(--ink-accent)' : 'var(--ink-border)',
                  backgroundColor: importMode === 'paste' ? 'rgba(128,0,32,0.08)' : 'var(--ink-bg)',
                  color: 'var(--ink-text)',
                }}
              >
                Paste text
              </button>
              <button
                type="button"
                onClick={() => setImportMode('file')}
                className="rounded-full border px-4 py-2 text-sm font-medium"
                style={{
                  borderColor: importMode === 'file' ? 'var(--ink-accent)' : 'var(--ink-border)',
                  backgroundColor: importMode === 'file' ? 'rgba(128,0,32,0.08)' : 'var(--ink-bg)',
                  color: 'var(--ink-text)',
                }}
              >
                Upload file
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium" style={{ color: 'var(--ink-text)' }}>Book title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Optional. Leave blank to use the file name or an auto title."
                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
              />
            </label>

            {importMode === 'paste' ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium" style={{ color: 'var(--ink-text)' }}>Paste plain text</span>
                <textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder="Paste a whole book, several chapters, or a long article. Chapter headings like 'Chapter 12' are detected automatically."
                  className="min-h-[320px] w-full rounded-3xl border px-4 py-4 text-sm outline-none"
                  style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
                />
              </label>
            ) : (
              <label className="block">
                <span className="mb-2 block text-sm font-medium" style={{ color: 'var(--ink-text)' }}>Choose a `.txt`, `.md`, `.pdf`, or `.epub` file</span>
                <input
                  type="file"
                  data-testid="reader-file-input"
                  accept=".txt,.md,.pdf,.epub,text/plain,application/pdf,application/epub+zip"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  className="w-full rounded-2xl border px-4 py-3 text-sm"
                  style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
                />
                {selectedFile ? (
                  <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                    Selected: {selectedFile.name}
                  </p>
                ) : null}
              </label>
            )}

            {error ? (
              <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: '#f5b3b3', backgroundColor: '#fff2f2', color: '#7f1d1d' }}>
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                data-testid="reader-detect-chapters"
                onClick={() => void parseImport()}
                disabled={busy}
                className="rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--ink-accent)' }}
              >
                {busy ? 'Importing…' : 'Detect chapters'}
              </button>
              {draft ? (
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="rounded-2xl border px-5 py-3 text-sm font-semibold"
                  style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                >
                  Clear preview
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)' }}>
            <h2 className="mb-3 font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>Library</h2>
            {libraryCards.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                No saved books yet. Import one on the left and it will stay on this device with resume links and offline-friendly storage.
              </p>
            ) : (
              <div className="space-y-3">
                {libraryCards.map((item) => (
                  <div key={item.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--ink-text)' }}>{item.title}</h3>
                        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                          {item.chapterCount} chapters · {item.totalWords.toLocaleString()} words · {sourceLabel(item.sourceType)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteReaderPublication(item.id).then(loadLibrary)}
                        className="rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-muted)' }}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Updated {formatUpdatedAt(item.updatedAt)}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void getReaderPublication(item.id).then((pub) => {
                              if (pub) exportPublicationAsTxt(pub)
                            })
                          }
                          className="rounded-full border px-4 py-2 text-sm font-medium"
                          style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                        >
                          Export .txt
                        </button>
                        <Link
                          href={`${routeBase}/read/${item.id}/${item.firstChapterId}`}
                          className="rounded-full border px-4 py-2 text-sm font-medium"
                          style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                        >
                          Open from start
                        </Link>
                        <Link
                          href={item.resumeHref}
                          className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                          style={{ backgroundColor: 'var(--ink-accent)' }}
                        >
                          Resume
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {draft ? (
        <div
          className="rounded-3xl border p-5 md:p-6"
          data-testid="reader-import-preview"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink-accent)' }}>Imported preview</p>
              <h2 className="font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>{draft.title}</h2>
              <p className="mt-1 text-sm" data-testid="reader-chapter-summary" style={{ color: 'var(--ink-muted)' }}>
                {draft.chapters.length} detected chapters · {sourceLabel(draft.sourceType)}
                {draft.originalFileName ? ` · ${draft.originalFileName}` : ''}
              </p>
            </div>
            <button
              type="button"
              data-testid="reader-save-open"
              onClick={() => void saveDraft()}
              className="rounded-2xl px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--ink-accent)' }}
            >
              Save to library and open reader
            </button>
          </div>

          {draft.importNotes.length > 0 ? (
            <div className="mb-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-muted)' }}>
              <p className="mb-2 font-semibold" style={{ color: 'var(--ink-text)' }}>Import notes</p>
              <ul className="list-disc pl-5">
                {draft.importNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-4">
            {draft.chapters.map((chapter, index) => (
              <div key={chapter.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)' }}>
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--ink-muted)' }}>
                        Chapter {index + 1}
                      </span>
                      <input
                        value={chapter.title}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? { ...current, chapters: renameChapter(current.chapters, chapter.id, event.target.value) }
                              : current,
                          )
                        }
                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? { ...current, chapters: mergeWithPreviousChapter(current.chapters, chapter.id) }
                            : current,
                        )
                      }
                      className="rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                      style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                    >
                      Merge up
                    </button>
                    <button
                      type="button"
                      disabled={chapter.paragraphs.length < 2}
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? { ...current, chapters: splitChapterAtMidpoint(current.chapters, chapter.id) }
                            : current,
                        )
                      }
                      className="rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                      style={{ borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                    >
                      Split in half
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
                  <span>{chapter.wordCount.toLocaleString()} words</span>
                  <span>{chapter.paragraphs.length} paragraphs</span>
                </div>

                <div className="rounded-2xl border px-4 py-3 text-sm leading-7" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}>
                  {chapter.paragraphs.slice(0, 2).map((paragraph) => (
                    <p key={paragraph.slice(0, 24)} className="mb-4 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
