'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useCallback } from 'react'
import {
  attachmentDataUrl,
  approxBase64Bytes,
  formatFileSize,
  spreadsheetPreviewText,
} from '@/lib/notes/attachments'
import type { NoteAttachmentStorage } from '@/lib/notes/tiptap/noteAttachment'
import type { AttachmentDisplay, SpreadsheetPreview } from '@/lib/notes/types'
import AttachmentFrame from './AttachmentFrame'

function fileIcon(kind: string | undefined, mime: string): string {
  if (kind === 'spreadsheet') return '▦'
  if (kind === 'document' || mime === 'application/pdf') return '📄'
  if (kind === 'image') return '🖼'
  return '📎'
}

function ImageContent({ src, crop }: { src: string; crop?: AttachmentDisplay['crop'] }) {
  const cropStyle = crop
    ? {
        objectPosition: `${-crop.x * 100}% ${-crop.y * 100}%`,
        width: `${100 / crop.w}%`,
        height: `${100 / crop.h}%`,
        maxWidth: 'none',
        maxHeight: 'none',
      }
    : undefined

  return (
    <div className={`note-attachment__image-wrap${crop ? ' note-attachment__image-wrap--crop' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="note-attachment__img"
        data-testid="notes-attachment-img"
        draggable={false}
        style={cropStyle}
      />
    </div>
  )
}

function SpreadsheetContent({
  preview,
  onPreviewChange,
}: {
  preview: SpreadsheetPreview
  onPreviewChange: (next: SpreadsheetPreview) => void
}) {
  const onCellBlur = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      const rows = preview.rows.map((r, ri) =>
        ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? value : c)) : [...r],
      )
      onPreviewChange({ ...preview, rows })
    },
    [preview, onPreviewChange],
  )

  const onHeaderBlur = useCallback(
    (colIdx: number, value: string) => {
      const headers = preview.headers.map((h, i) => (i === colIdx ? value : h))
      onPreviewChange({ ...preview, headers })
    },
    [preview, onPreviewChange],
  )

  return (
    <div className="note-attachment__sheet" data-testid="notes-attachment-sheet">
      <div className="note-attachment__sheet-bar">
        <span className="font-medium">{preview.sheetName}</span>
        <span className="text-[10px] text-[var(--uv-text-muted)]">
          {preview.totalRows}×{preview.totalCols}
          {preview.totalRows > preview.rows.length ? ' (preview)' : ''}
        </span>
      </div>
      <div className="note-attachment__sheet-scroll">
        <table className="note-attachment__table">
          <thead>
            <tr>
              {preview.headers.map((h, ci) => (
                <th key={ci}>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    className="note-attachment__cell-editable"
                    onBlur={(e) => onHeaderBlur(ci, e.currentTarget.textContent ?? '')}
                  >
                    {h}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, ri) => (
              <tr key={ri}>
                {preview.headers.map((_, ci) => (
                  <td key={ci}>
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      className="note-attachment__cell-editable"
                      onBlur={(e) => onCellBlur(ri, ci, e.currentTarget.textContent ?? '')}
                    >
                      {row[ci] ?? ''}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FileCardContent({
  filename,
  mimeType,
  sizeLabel,
  href,
}: {
  filename: string
  mimeType: string
  sizeLabel: string
  href: string
}) {
  return (
    <div className="note-attachment__file" data-testid="notes-attachment-file">
      <span className="note-attachment__file-icon" aria-hidden>
        {fileIcon('file', mimeType)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--uv-text-primary)]">{filename}</p>
        <p className="text-[10px] text-[var(--uv-text-muted)]">
          {mimeType || 'file'} · {sizeLabel}
        </p>
      </div>
      <a
        href={href}
        download={filename}
        className="shrink-0 rounded px-2 py-1 text-[11px] text-[var(--uv-accent)] hover:bg-[var(--uv-accent-dim)]"
        data-testid="notes-attachment-download"
        onClick={(e) => e.stopPropagation()}
      >
        Open
      </a>
    </div>
  )
}

export default function NoteAttachmentView({ node, selected, editor }: NodeViewProps) {
  const id = String(node.attrs.attachmentId ?? '')
  const storage = editor.storage.noteAttachment as NoteAttachmentStorage | undefined
  const attachment = id ? storage?.screenshots?.[id] : undefined

  const patchDisplay = useCallback(
    (patch: Partial<AttachmentDisplay>) => {
      if (!id || !storage?.onUpdate) return
      storage.onUpdate(id, { display: { ...attachment?.display, ...patch } })
    },
    [id, storage, attachment?.display],
  )

  const patchPreview = useCallback(
    (preview: SpreadsheetPreview) => {
      if (!id || !storage?.onUpdate) return
      storage.onUpdate(id, { preview })
    },
    [id, storage],
  )

  const toggleCrop = useCallback(() => {
    if (!attachment || attachment.kind !== 'image' || !storage?.onUpdate) return
    const display = { ...attachment.display }
    if (display.crop) {
      delete display.crop
    } else {
      display.crop = { x: 0, y: 0, w: 0.85, h: 0.85 }
    }
    storage.onUpdate(id, { display })
  }, [attachment, storage, id])

  if (!attachment) {
    return (
      <NodeViewWrapper
        as="figure"
        className={`note-attachment${selected ? ' note-attachment--selected' : ''}`}
        data-testid="notes-attachment"
        data-attachment-id={id}
      >
        <div className="note-attachment__missing" data-testid="notes-attachment-missing">
          <span className="text-lg" aria-hidden>
            📎
          </span>
          <span className="text-[11px] text-[var(--uv-text-muted)]">{id || 'attachment'}</span>
        </div>
      </NodeViewWrapper>
    )
  }

  const kind = attachment.kind ?? (attachment.mimeType.startsWith('image/') ? 'image' : 'file')
  const href = attachmentDataUrl(attachment)
  const sizeLabel = formatFileSize(approxBase64Bytes(attachment.base64))

  return (
    <NodeViewWrapper
      as="figure"
      className={`note-attachment note-attachment--${kind}${selected ? ' note-attachment--selected' : ''}`}
      data-testid="notes-attachment"
      data-attachment-id={id}
      data-attachment-kind={kind}
    >
      {selected && kind === 'image' ? (
        <div className="note-attachment__toolbar">
          <button type="button" className="note-attachment__tool-btn" onClick={toggleCrop}>
            {attachment.display?.crop ? 'Full image' : 'Crop view'}
          </button>
        </div>
      ) : null}

      <AttachmentFrame
        selected={selected}
        display={attachment.display}
        minWidth={kind === 'file' ? 200 : 160}
        minHeight={kind === 'spreadsheet' ? 120 : 80}
        onDisplayChange={patchDisplay}
      >
        {kind === 'image' ? (
          <ImageContent src={href} crop={attachment.display?.crop} />
        ) : kind === 'spreadsheet' && attachment.preview ? (
          <SpreadsheetContent preview={attachment.preview} onPreviewChange={patchPreview} />
        ) : (
          <FileCardContent
            filename={attachment.filename ?? id}
            mimeType={attachment.mimeType}
            sizeLabel={sizeLabel}
            href={href}
          />
        )}
      </AttachmentFrame>

      {attachment.filename ? (
        <figcaption className="note-attachment__caption">{attachment.filename}</figcaption>
      ) : null}
    </NodeViewWrapper>
  )
}

export { spreadsheetPreviewText }
