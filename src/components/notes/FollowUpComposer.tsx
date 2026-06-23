'use client'

import { useCallback, useRef, useState } from 'react'
import {
  imageFileFromClipboard,
  imageFilesFromDataTransfer,
  newAttachmentId,
  readImageFile,
  screenshotDataUrl,
} from '@/lib/notes/attachments'
import type { Screenshot } from '@/lib/notes/types'

type FollowUpComposerProps = {
  onSubmit: (question: string, screenshots?: Screenshot[]) => void
}

export default function FollowUpComposer({ onSubmit }: FollowUpComposerProps) {
  const [pending, setPending] = useState<Screenshot[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const { base64, mimeType } = await readImageFile(file)
    const shot: Screenshot = { id: newAttachmentId('follow-shot'), base64, mimeType }
    setPending((prev) => [...prev, shot])
  }, [])

  const addFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) await addFile(file)
    },
    [addFile],
  )

  const removeShot = (id: string) => setPending((prev) => prev.filter((s) => s.id !== id))

  return (
    <form
      className="mt-2"
      data-testid="notes-followup-form"
      onPaste={(e) => {
        const file = imageFileFromClipboard(e)
        if (!file) return
        e.preventDefault()
        void addFile(file)
      }}
      onDrop={(e) => {
        const files = imageFilesFromDataTransfer(e.dataTransfer)
        if (!files.length) return
        e.preventDefault()
        void addFiles(files)
      }}
      onDragOver={(e) => {
        if (imageFilesFromDataTransfer(e.dataTransfer).length) e.preventDefault()
      }}
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const q = String(fd.get('followup') ?? '').trim()
        if (!q && !pending.length) return
        onSubmit(q || 'What do you see in the attached screenshot?', pending.length ? pending : undefined)
        setPending([])
        e.currentTarget.reset()
      }}
    >
      {pending.length > 0 ? (
        <ul
          className="mb-2 flex flex-wrap gap-2"
          data-testid="notes-followup-attachments"
          aria-label="Attached screenshots"
        >
          {pending.map((shot) => (
            <li key={shot.id} className="note-followup-attachment group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshotDataUrl(shot)}
                alt=""
                className="note-followup-attachment__img"
                data-testid="notes-followup-attachment-img"
              />
              <button
                type="button"
                aria-label="Remove screenshot"
                data-testid="notes-followup-attachment-remove"
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-[var(--uv-bg-elevated)] text-[10px] shadow group-hover:flex"
                onClick={() => removeShot(shot.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-1">
        <input
          name="followup"
          placeholder="Follow-up ↵ · paste or drop screenshot"
          data-testid="notes-followup-input"
          className="min-w-0 flex-1 rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1.5 text-sm text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:border-[var(--uv-accent)] focus:outline-none"
        />
        <button
          type="button"
          title="Attach screenshot"
          data-testid="notes-followup-attach-btn"
          className="shrink-0 rounded border border-[var(--uv-border)] px-2 text-sm hover:bg-[var(--uv-bg-hover)]"
          onClick={() => fileInputRef.current?.click()}
        >
          📷
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="notes-followup-file-input"
          onChange={(e) => {
            const files = e.target.files ? [...e.target.files] : []
            e.target.value = ''
            if (files.length) void addFiles(files)
          }}
        />
      </div>
    </form>
  )
}
