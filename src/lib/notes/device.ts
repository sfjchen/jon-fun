/** Phone vs laptop/desktop split — matches Tailwind `md` and notes.css. */
export const NOTES_MOBILE_MAX_PX = 767
export const NOTES_DESKTOP_MIN_MQ = '(min-width: 768px)'

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) return true
  const uad = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  if (uad?.platform === 'macOS') return true
  return /Macintosh/.test(ua)
}

export function isNotesMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${NOTES_MOBILE_MAX_PX}px)`).matches
}

export function modKeyLabel(): 'Cmd' | 'Ctrl' {
  return isMacPlatform() ? 'Cmd' : 'Ctrl'
}

/** Replace Windows-style Ctrl labels with Cmd on Mac for UI badges. */
export function formatNotesShortcut(base: string): string {
  if (!isMacPlatform()) return base
  return base.replace(/Ctrl\+/g, 'Cmd+').replace(/Ctrl-/g, 'Cmd-')
}
