import { formatNotesShortcut } from './device'

/** Windows-style shortcut labels (display + handler reference). */
export const NOTES_SHORTCUTS = {
  search: 'Ctrl+Shift+F',
  newNote: 'Ctrl+Shift+N',
  export: 'Ctrl+E',
  summarize: 'Ctrl+K',
  panel: 'Ctrl+\\',
  hints: 'Ctrl+Shift+H',
  save: 'Ctrl+S',
} as const

export type NotesShortcutKey = keyof typeof NOTES_SHORTCUTS

export function notesShortcutLabel(key: NotesShortcutKey): string {
  return formatNotesShortcut(NOTES_SHORTCUTS[key])
}

export function isNotesTextFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** True when focus is in the Tiptap editor (ProseMirror), not panel inputs. */
export function isNotesEditorTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('.ProseMirror')
}
