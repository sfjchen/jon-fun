import { useEffect, useSyncExternalStore } from 'react'

import { modKeyLabel } from '@/lib/notes/device'

export { isMacPlatform, modKeyLabel } from '@/lib/notes/device'

export function isModKey(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return e.metaKey || e.ctrlKey
}

export function isModEnter(e: { key: string; metaKey: boolean; ctrlKey: boolean }): boolean {
  return e.key === 'Enter' && isModKey(e)
}

export function isModD(e: { key: string; metaKey: boolean; ctrlKey: boolean }): boolean {
  return e.key.toLowerCase() === 'd' && isModKey(e)
}

/** Client-safe mod key label (avoids Mac → Ctrl flash during hydration). */
export function useModKeyLabel(): 'Cmd' | 'Ctrl' {
  return useSyncExternalStore(
    () => () => {},
    modKeyLabel,
    () => 'Ctrl',
  )
}

export function dailyLearnSubmitHint(mod: 'Cmd' | 'Ctrl' = modKeyLabel()): string {
  return `${mod}+Enter to submit · Esc to cancel`
}

/**
 * Returns whether the event target is a field the player types into, where single keys must stay text.
 */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t instanceof HTMLElement ? t.closest<HTMLElement>('input,textarea,select,[contenteditable="true"]') : null
  return !!el && !(el instanceof HTMLInputElement && /^(range|checkbox|radio|button|submit|reset|file|color)$/.test(el.type))
}

/**
 * Listens for plain key presses page-wide and passes each to `handle`, with letters lowercased. Skips presses with
 * Cmd, Ctrl or Alt held, presses while typing in a field or composing text, presses another handler already used,
 * Enter and Space on a focused button or link, and, unless `modal` is set, presses while a modal dialog is open.
 * `handle` returns true when it used the key, which stops the browser's default action.
 */
export function useHotkeys(handle: (key: string, e: KeyboardEvent) => boolean | void, on = true, modal = false): void {
  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing || isTypingTarget(e.target)) return
      const t = e.target instanceof HTMLElement ? e.target : null
      // A focused slider keeps its own arrow, Home, End and Page keys.
      if (t instanceof HTMLInputElement && t.type === 'range' && /^(Arrow|Home|End|Page)/.test(e.key)) return
      if ((e.key === 'Enter' || e.key === ' ') && t?.closest('button,a,summary,[role=button]')) return
      if (!modal && document.querySelector('[aria-modal="true"]')) return
      if (handle(e.key.length === 1 ? e.key.toLowerCase() : e.key, e)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}

/** Keyboard rows that mirror a grid of tiles or cards, so the key's place on the keyboard is the tile's place. */
const GRID_ROWS = ['1234567', 'qwertyu', 'asdfghj', 'zxcvbnm']

/**
 * Returns the index of the grid item a key points at for a grid `cols` wide, or -1 when the key is off the grid.
 */
export function gridKeyIndex(key: string, cols: number): number {
  const row = GRID_ROWS.findIndex((r) => r.slice(0, cols).includes(key))
  if (row >= 0) return row * cols + GRID_ROWS[row]!.indexOf(key)
  // Extra rows past the 4th continue on the next keys to the right, 3 at a time, as Set with Friends lays them out.
  const extra = cols === 3 ? 'rtyfghvbn'.indexOf(key) : -1
  return extra < 0 ? -1 : 12 + extra
}
