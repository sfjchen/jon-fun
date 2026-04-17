import type {
  ReaderAccent,
  ReaderCssVariables,
  ReaderFontPreset,
  ReaderPreferences,
  ReaderTheme,
  ReaderThemeTokens,
} from '@/lib/reader/types'

const PREFS_KEY = 'reader:v1:prefs'
const LAST_BOOK_KEY = 'reader:v1:last-book'
const LAST_ROUTE_KEY = 'reader:v1:last-route'
const BOOKMARK_PREFIX = 'reader:v1:bookmark'
const PROGRESS_PREFIX = 'reader:v1:progress'

const ACCENT_MAP: Record<ReaderAccent, string> = {
  sky: '#2f81f7',
  emerald: '#0f9f6e',
  violet: '#805ad5',
  amber: '#d97706',
  rose: '#e11d48',
}

const THEME_TOKENS: Record<ReaderTheme, ReaderThemeTokens> = {
  paper: {
    bg: '#f7f5f1',
    panel: '#ffffff',
    text: '#1f2937',
    muted: '#6b7280',
    border: '#d7dce3',
    chrome: '#edf2f7',
  },
  sepia: {
    bg: '#f7efe4',
    panel: '#fffaf2',
    text: '#33261c',
    muted: '#7c6a57',
    border: '#dccab2',
    chrome: '#f3e3ce',
  },
  night: {
    bg: '#13171d',
    panel: '#1d232d',
    text: '#edf2f7',
    muted: '#a0aec0',
    border: '#2d3748',
    chrome: '#0e141b',
  },
  midnight: {
    bg: '#0d1321',
    panel: '#182033',
    text: '#edf2f7',
    muted: '#9fb1d1',
    border: '#2b3a55',
    chrome: '#0a1020',
  },
}

const FONT_MAP: Record<ReaderFontPreset, string> = {
  default: 'Charter, "Bitstream Charter", Georgia, serif',
  lora: '"Lora", Georgia, serif',
  roboto: '"Roboto", Arial, sans-serif',
  accessible: 'Verdana, Tahoma, Arial, sans-serif',
}

export const defaultReaderPreferences: ReaderPreferences = {
  fontPreset: 'default',
  fontSize: 19,
  lineHeight: 1.7,
  paragraphGap: 24,
  maxWidth: 820,
  textAlign: 'left',
  textIndent: false,
  bionic: false,
  copyEnabled: true,
  theme: 'paper',
  accent: 'sky',
  panelOpen: true,
  autoScrollEnabled: false,
  autoScrollSpeed: 1.4,
  autoNextChapter: false,
  ttsRate: 1,
  voiceURI: '',
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function getAccentColor(accent: ReaderAccent): string {
  return ACCENT_MAP[accent]
}

export function getThemeTokens(theme: ReaderTheme): ReaderThemeTokens {
  return THEME_TOKENS[theme]
}

export function getFontFamily(preset: ReaderFontPreset): string {
  return FONT_MAP[preset]
}

export function loadReaderPreferences(): ReaderPreferences {
  if (!isBrowser()) return defaultReaderPreferences

  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return defaultReaderPreferences
    const parsed = JSON.parse(raw) as Partial<ReaderPreferences>
    return { ...defaultReaderPreferences, ...parsed }
  } catch {
    return defaultReaderPreferences
  }
}

export function saveReaderPreferences(prefs: ReaderPreferences) {
  if (!isBrowser()) return
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function readerCssVariables(prefs: ReaderPreferences): ReaderCssVariables {
  const theme = getThemeTokens(prefs.theme)
  const accent = getAccentColor(prefs.accent)

  return {
    '--reader-bg': theme.bg,
    '--reader-panel': theme.panel,
    '--reader-text': theme.text,
    '--reader-muted': theme.muted,
    '--reader-border': theme.border,
    '--reader-chrome': theme.chrome,
    '--reader-accent': accent,
    '--reader-font-family': getFontFamily(prefs.fontPreset),
    '--reader-font-size': `${prefs.fontSize}px`,
    '--reader-line-height': String(prefs.lineHeight),
    '--reader-paragraph-gap': `${prefs.paragraphGap}px`,
    '--reader-max-width': `${prefs.maxWidth}px`,
  }
}

function progressKey(bookId: string, chapterId: string): string {
  return `${PROGRESS_PREFIX}:${bookId}:${chapterId}`
}

function bookmarkKey(bookId: string): string {
  return `${BOOKMARK_PREFIX}:${bookId}`
}

export function saveReaderProgress(bookId: string, chapterId: string, scrollY: number) {
  if (!isBrowser()) return

  const payload = {
    chapterId,
    scrollY,
    savedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(progressKey(bookId, chapterId), JSON.stringify(payload))
  window.localStorage.setItem(LAST_BOOK_KEY, bookId)
  window.localStorage.setItem(LAST_ROUTE_KEY, `${bookId}:${chapterId}`)
}

export function loadReaderProgress(bookId: string, chapterId: string): { scrollY: number; savedAt: string } | null {
  if (!isBrowser()) return null

  try {
    const raw = window.localStorage.getItem(progressKey(bookId, chapterId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { scrollY?: number; savedAt?: string }
    if (typeof parsed.scrollY !== 'number' || typeof parsed.savedAt !== 'string') return null
    return { scrollY: parsed.scrollY, savedAt: parsed.savedAt }
  } catch {
    return null
  }
}

export function saveReaderBookmark(bookId: string, chapterId: string, scrollY: number) {
  if (!isBrowser()) return

  const payload = {
    chapterId,
    scrollY,
    savedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(bookmarkKey(bookId), JSON.stringify(payload))
}

export function loadReaderBookmark(bookId: string): { chapterId: string; scrollY: number; savedAt: string } | null {
  if (!isBrowser()) return null

  try {
    const raw = window.localStorage.getItem(bookmarkKey(bookId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { chapterId?: string; scrollY?: number; savedAt?: string }
    if (typeof parsed.chapterId !== 'string' || typeof parsed.scrollY !== 'number' || typeof parsed.savedAt !== 'string') return null
    return {
      chapterId: parsed.chapterId,
      scrollY: parsed.scrollY,
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}

export function loadLastReaderBookId(): string {
  if (!isBrowser()) return ''
  return window.localStorage.getItem(LAST_BOOK_KEY) ?? ''
}

export function loadLastReaderLocation(): { bookId: string; chapterId: string } | null {
  if (!isBrowser()) return null
  const raw = window.localStorage.getItem(LAST_ROUTE_KEY)
  if (!raw) return null
  const [bookId, chapterId] = raw.split(':')
  if (!bookId || !chapterId) return null
  return { bookId, chapterId }
}
