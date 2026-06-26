import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { FontSize, TextStyle } from '@tiptap/extension-text-style'
import { Markdown } from '@tiptap/markdown'
import { notesKeymap } from './keymap'
import { createShorthandDecorationsExtension } from './shorthandDecorations'
import { attachmentPasteExtension } from './attachmentPaste'
import { NoteAttachment } from './noteAttachment'
import { dashListExtension } from './dashList'
import { notesEditingExtension } from './notesEditing'
import { NotesItalic } from './notesItalic'
import { notesTableKit } from './tableConfig'
import { tableKeymap } from './tableKeymap'
import { richPasteExtension } from './richPaste'
import { tablePasteExtension } from './tablePaste'

export type NotesExtensionOpts = {
  placeholder: string
  getActiveQueries: () => string[]
}

export function buildNotesExtensions(opts: NotesExtensionOpts): Extensions {
  return [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      italic: false,
      link: false,
      underline: false,
      heading: { levels: [1, 2, 3] },
    }),
    NotesItalic,
    TextStyle,
    FontSize,
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
    }),
    NoteAttachment,
    notesTableKit,
    Markdown,
    Placeholder.configure({ placeholder: opts.placeholder }),
    notesKeymap,
    tableKeymap,
    notesEditingExtension,
    dashListExtension,
    attachmentPasteExtension,
    richPasteExtension,
    tablePasteExtension,
    createShorthandDecorationsExtension(opts.getActiveQueries),
  ]
}

/** Preset font sizes for the bubble menu (px). */
export const NOTES_FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px'] as const

/** Default editor font size; matches notes.css `.tiptap` and unset `textStyle.fontSize`. */
export const NOTES_DEFAULT_FONT_SIZE = '14px'

/** Default editor line-height (unitless); matches notes.css `--notes-line-height`. */
export const NOTES_DEFAULT_LINE_HEIGHT = '1.25'

export const NOTES_LINE_HEIGHTS = ['1', '1.25', '1.5', '1.75', '2'] as const

const NOTES_LINE_HEIGHT_VALUES = NOTES_LINE_HEIGHTS.map((lh) => parseFloat(lh))

/** Map legacy or out-of-range saved prefs to the nearest preset (default 1.25×). */
export function normalizeNotesLineHeight(saved?: string): string {
  if (saved && (NOTES_LINE_HEIGHTS as readonly string[]).includes(saved)) return saved
  if (saved) {
    const n = parseFloat(saved)
    if (!Number.isNaN(n) && n >= 1 && n <= 2) {
      const nearest = NOTES_LINE_HEIGHT_VALUES.reduce((best, q) =>
        Math.abs(q - n) < Math.abs(best - n) ? q : best,
      )
      return String(nearest)
    }
  }
  return NOTES_DEFAULT_LINE_HEIGHT
}

export const NOTES_EDITOR_PLACEHOLDER = 'Start typing…'
