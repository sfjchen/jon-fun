'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { NoteAttachmentStorage } from '@/lib/notes/tiptap/noteAttachment'
import { screenshotDataUrl } from '@/lib/notes/attachments'

export default function NoteAttachmentView({ node, selected, editor }: NodeViewProps) {
  const id = String(node.attrs.attachmentId ?? '')
  const storage = editor.storage.noteAttachment as NoteAttachmentStorage | undefined
  const shot = id ? storage?.screenshots?.[id] : undefined
  const src = shot ? screenshotDataUrl(shot) : null

  return (
    <NodeViewWrapper
      as="figure"
      className={`note-attachment${selected ? ' note-attachment--selected' : ''}`}
      data-testid="notes-attachment"
      data-attachment-id={id}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={id}
          className="note-attachment__img"
          data-testid="notes-attachment-img"
          draggable={false}
        />
      ) : (
        <div className="note-attachment__missing" data-testid="notes-attachment-missing">
          <span className="text-lg" aria-hidden>
            📷
          </span>
          <span className="text-[11px] text-[var(--uv-text-muted)]">{id || 'attachment'}</span>
        </div>
      )}
    </NodeViewWrapper>
  )
}
