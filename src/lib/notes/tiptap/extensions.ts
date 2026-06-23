import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Markdown } from '@tiptap/markdown'
import { notesKeymap } from './keymap'
import { createShorthandDecorationsExtension } from './shorthandDecorations'
import { NoteAttachment } from './noteAttachment'

export type NotesExtensionOpts = {
  placeholder: string
  getActiveQuery: () => string | null
}

export function buildNotesExtensions(opts: NotesExtensionOpts): Extensions {
  return [
    StarterKit.configure({
      blockquote: false,
      italic: false,
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
    }),
    NoteAttachment,
    Markdown,
    Placeholder.configure({ placeholder: opts.placeholder }),
    notesKeymap,
    createShorthandDecorationsExtension(opts.getActiveQuery),
  ]
}

export const NOTES_EDITOR_PLACEHOLDER =
  'Start typing. Line? for AI · Line?? for section · text> todo · *highlight*'
