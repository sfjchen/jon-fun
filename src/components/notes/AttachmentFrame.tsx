'use client'

import { useCallback, useRef } from 'react'
import type { AttachmentDisplay } from '@/lib/notes/types'

type AttachmentFrameProps = {
  selected: boolean
  display?: AttachmentDisplay | undefined
  minWidth?: number
  minHeight?: number
  onDisplayChange: (patch: Partial<AttachmentDisplay>) => void
  children: React.ReactNode
  testId?: string
}

export default function AttachmentFrame({
  selected,
  display,
  minWidth = 160,
  minHeight = 80,
  onDisplayChange,
  children,
  testId,
}: AttachmentFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

  const width = display?.widthPx ?? 480
  const height = display?.heightPx ?? 280

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = { startX: e.clientX, startY: e.clientY, startW: width, startH: height }

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const dw = ev.clientX - dragRef.current.startX
        const dh = ev.clientY - dragRef.current.startY
        onDisplayChange({
          widthPx: Math.max(minWidth, dragRef.current.startW + dw),
          heightPx: Math.max(minHeight, dragRef.current.startH + dh),
        })
      }
      const onUp = () => {
        dragRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [width, height, minWidth, minHeight, onDisplayChange],
  )

  return (
    <div
      ref={frameRef}
      className="note-attachment__frame"
      style={{ width: `${width}px`, height: `${height}px` }}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <div className="note-attachment__frame-body">{children}</div>
      {selected ? (
        <button
          type="button"
          aria-label="Resize attachment"
          data-testid="notes-attachment-resize"
          className="note-attachment__resize-handle"
          onMouseDown={onResizeStart}
        />
      ) : null}
    </div>
  )
}
