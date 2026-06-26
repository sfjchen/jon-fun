/** UI preferences persisted in localStorage (device-local). */

export type NotesUiPrefs = {
  panelOpen?: boolean
  notesListOpen?: boolean
  rollupOpen?: boolean
  syncOpen?: boolean
  shorthandOpen?: boolean
  panelWidth?: number
  expandedFolderIds?: string[]
  /** Document-wide line-height multiplier (unitless string, e.g. "1.25"). */
  lineHeight?: string
  /** Right-pane session id when split view is open (desktop). */
  splitSessionId?: string | null
  /** Left pane width fraction when split (0.25–0.75). */
  splitRatio?: number
}

const PREFS_KEY = 'notes_ui_prefs'

export function loadNotesUiPrefs(): NotesUiPrefs {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as NotesUiPrefs
  } catch {
    return {}
  }
}

export function saveNotesUiPrefs(patch: NotesUiPrefs): void {
  if (typeof window === 'undefined') return
  const next = { ...loadNotesUiPrefs(), ...patch }
  localStorage.setItem(PREFS_KEY, JSON.stringify(next))
}

/** Normalize legacy default titles after rebrand. */
export function normalizeSessionTitle(title: string): string {
  return title.replace(/^Meeting\b/, 'Note')
}
