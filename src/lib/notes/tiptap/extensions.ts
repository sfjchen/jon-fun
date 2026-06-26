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
  getActiveQuery: () => string | null
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
    createShorthandDecorationsExtension(opts.getActiveQuery),
  ]
}

/** Preset font sizes for the bubble menu (px). */
export const NOTES_FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px'] as const

export const NOTES_EDITOR_PLACEHOLDER = 'Start typing…'
