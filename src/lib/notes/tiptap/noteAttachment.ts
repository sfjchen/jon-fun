import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { Screenshot } from '../types'
import NoteAttachmentView from '@/components/notes/NoteAttachmentView'

export type NoteAttachmentStorage = {
  screenshots: Record<string, Screenshot>
}

declare module '@tiptap/core' {
  interface Storage {
    noteAttachment: NoteAttachmentStorage
  }
}

export const NoteAttachment = Node.create<Record<string, never>, NoteAttachmentStorage>({
  name: 'noteAttachment',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addStorage() {
    return { screenshots: {} }
  },

  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-note-attachment'),
        renderHTML: (attrs) =>
          attrs.attachmentId ? { 'data-note-attachment': attrs.attachmentId } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-note-attachment]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)]
  },

  parseMarkdown: (token, helpers) =>
    helpers.createNode('noteAttachment', { attachmentId: token.attachmentId }),

  renderMarkdown: (node) => `[📷 ${node.attrs?.attachmentId ?? ''}]`,

  markdownTokenizer: {
    name: 'noteAttachment',
    level: 'block',
    start(src) {
      const idx = src.search(/^\[📷/)
      return idx === -1 ? -1 : idx
    },
    tokenize(src) {
      const match = /^\[📷\s*([^\]]+)\]\s*(?:\n|$)?/.exec(src)
      if (!match) return undefined
      return {
        type: 'noteAttachment',
        raw: match[0],
        attachmentId: match[1]!.trim(),
      }
    },
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteAttachmentView)
  },
})
