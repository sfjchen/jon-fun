export type ReaderSourceType = 'txt' | 'paste' | 'pdf'

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

export type ReaderChapter = {
  id: string
  order: number
  title: string
  paragraphs: string[]
  wordCount: number
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

export type ReaderProgress = {
  chapterId: string
  scrollY: number
  savedAt: string
}

export type ReaderBookmark = {
  chapterId: string
  scrollY: number
  savedAt: string
}

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
}

export type ReaderCssVariables = Record<`--reader-${string}`, string>

export type ReaderImportDraft = {
  title: string
  sourceType: ReaderSourceType
  chapters: ReaderChapter[]
  originalFileName?: string
  importNotes: string[]
}
