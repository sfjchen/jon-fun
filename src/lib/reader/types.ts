export type ReaderSourceType = 'txt' | 'paste' | 'pdf' | 'epub'

export type ReaderFontPreset = 'default' | 'lora' | 'roboto' | 'accessible'

export type ReaderTheme = 'paper' | 'sepia' | 'night' | 'midnight'

export type ReaderTextAlign = 'left' | 'right' | 'justify' | 'center'

export type ReaderAccent = 'sky' | 'emerald' | 'violet' | 'amber' | 'rose'

export type ReaderThemeTokens = {
  bg: string
  panel: string
  text: string
  muted: string
  border: string
  chrome: string
}

/** Block-level text unit (v2 canonical model); optional on disk — derived from `paragraphs` when absent. */
export type ReaderBlockKind = 'paragraph' | 'heading'

export type ReaderBlock = {
  id: string
  kind: ReaderBlockKind
  text: string
}

/** Import / extract quality hints (ingest pipeline). */
export type ReaderIngestMeta = {
  /** 0–1 overall heuristic confidence for chapter boundaries & text quality. */
  overallConfidence?: number
  /** e.g. `scanned_pdf_likely`, `low_text_density`, `epub_spine_ok` */
  flags?: string[]
}

export type ReaderChapter = {
  id: string
  order: number
  title: string
  paragraphs: string[]
  wordCount: number
  /** When set, must align 1:1 with `paragraphs` length; otherwise IDs are derived at runtime. */
  blocks?: ReaderBlock[]
}

export type ReaderPublication = {
  id: string
  title: string
  sourceType: ReaderSourceType
  chapters: ReaderChapter[]
  createdAt: string
  updatedAt: string
  originalFileName?: string
  importNotes?: string[]
  ingestMeta?: ReaderIngestMeta
}

export type ReaderPublicationSummary = {
  id: string
  title: string
  sourceType: ReaderSourceType
  chapterCount: number
  totalWords: number
  updatedAt: string
  firstChapterId: string
}

/** Reading position: anchored to a block when possible, else scroll fallback. */
export type ReaderProgress = {
  chapterId: string
  scrollY: number
  savedAt: string
  /** Stable block id within chapter (`b-{chapterId}-p{index}`). */
  blockId?: string
  charOffset?: number
  /** 2 = anchored schema; omit/1 = legacy scroll-only. */
  schemaVersion?: 1 | 2
}

export type ReaderBookmark = {
  chapterId: string
  scrollY: number
  savedAt: string
  blockId?: string
  charOffset?: number
  schemaVersion?: 1 | 2
}

export type ReaderUiMode = 'novel' | 'study'

export type ReaderPreferences = {
  fontPreset: ReaderFontPreset
  fontSize: number
  lineHeight: number
  paragraphGap: number
  maxWidth: number
  textAlign: ReaderTextAlign
  textIndent: boolean
  bionic: boolean
  copyEnabled: boolean
  theme: ReaderTheme
  accent: ReaderAccent
  panelOpen: boolean
  autoScrollEnabled: boolean
  autoScrollSpeed: number
  autoNextChapter: boolean
  ttsRate: number
  voiceURI: string
  /** Novel = minimal chrome bias; study = denser controls (TOC open, settings available). */
  uiMode: ReaderUiMode
  /** Dim outside a horizontal reading band (focus). */
  focusBandEnabled: boolean
}

export type ReaderCssVariables = Record<`--reader-${string}`, string>

export type ReaderImportDraft = {
  title: string
  sourceType: ReaderSourceType
  chapters: ReaderChapter[]
  originalFileName?: string
  importNotes: string[]
  ingestMeta?: ReaderIngestMeta
}
