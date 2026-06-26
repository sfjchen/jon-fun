'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { isNoteSessionDrag, NOTE_SESSION_DRAG } from '@/lib/notes/dragTypes'
import type { NoteSession } from '@/lib/notes/types'

const SPLIT_MIN = 0.25
const SPLIT_MAX = 0.75

function clampSplitRatio(r: number): number {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, r))
}

type NotesSplitViewProps = {
  split: boolean
  splitRatio: number
  primarySession: NoteSession
  secondarySession: NoteSession | null
  leftHeader: ReactNode | null
  rightHeader: ReactNode | null
  leftEditor: ReactNode
  rightEditor: ReactNode | null
  onSplitRatioChange: (ratio: number) => void
  onDropNote: (sessionId: string, side: 'left' | 'right') => void
}

export default function NotesSplitView({
  split,
  splitRatio,
  primarySession,
  secondarySession,
  leftHeader,
  rightHeader,
  leftEditor,
  rightEditor,
  onSplitRatioChange,
  onDropNote,
}: NotesSplitViewProps) {
  const [vaultDrag, setVaultDrag] = useState(false)
  const [hoverSide, setHoverSide] = useState<'left' | 'right' | null>(null)
  const resizing = useRef(false)

  useEffect(() => {
    const onDragStart = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(NOTE_SESSION_DRAG)) setVaultDrag(true)
    }
    const clear = () => {
      setVaultDrag(false)
      setHoverSide(null)
    }
    document.addEventListener('dragstart', onDragStart)
    document.addEventListener('dragend', clear)
    document.addEventListener('drop', clear)
    return () => {
      document.removeEventListener('dragstart', onDragStart)
      document.removeEventListener('dragend', clear)
      document.removeEventListener('drop', clear)
    }
  }, [])

  const acceptNoteDrag = useCallback((e: React.DragEvent) => {
    if (!isNoteSessionDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDragEnterRoot = useCallback((e: React.DragEvent) => {
    if (!isNoteSessionDrag(e)) return
    setVaultDrag(true)
  }, [])

  const onDragLeaveRoot = useCallback((e: React.DragEvent) => {
    if (!isNoteSessionDrag(e)) return
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setVaultDrag(false)
    setHoverSide(null)
  }, [])

  const onDragEnd = useCallback(() => {
    setVaultDrag(false)
    setHoverSide(null)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent, side: 'left' | 'right') => {
      const sessionId =
        e.dataTransfer.getData(NOTE_SESSION_DRAG) || e.dataTransfer.getData('text/plain')
      if (!sessionId) return
      e.preventDefault()
      setVaultDrag(false)
      setHoverSide(null)
      onDropNote(sessionId, side)
    },
    [onDropNote],
  )

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      resizing.current = true
      const root = (e.currentTarget as HTMLElement).parentElement
      if (!root) return
      const rect = root.getBoundingClientRect()

      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return
        const x = ev.clientX - rect.left
        onSplitRatioChange(clampSplitRatio(x / rect.width))
      }
      const onUp = () => {
        resizing.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [onSplitRatioChange],
  )

  const dropOverlay = (side: 'left' | 'right') =>
    vaultDrag ? (
      <div
        role="presentation"
        className={`notes-split-drop-zone ${hoverSide === side ? 'notes-split-drop-zone-active' : ''}`}
        data-testid={`notes-split-drop-${side}`}
        onDragEnter={(e) => {
          acceptNoteDrag(e)
          setHoverSide(side)
        }}
        onDragOver={acceptNoteDrag}
        onDragLeave={(e) => {
          const next = e.relatedTarget as Node | null
          if (next && e.currentTarget.contains(next)) return
          setHoverSide((prev) => (prev === side ? null : prev))
        }}
        onDrop={(e) => onDrop(e, side)}
      >
        <span className="notes-split-drop-label">
          {side === 'left' ? 'Open in left pane' : 'Open in right pane'}
        </span>
      </div>
    ) : null

  if (!split || !secondarySession) {
    return (
      <div
        className={`notes-split-root notes-split-single relative flex min-h-0 flex-1 flex-col${vaultDrag ? ' notes-split-dragging' : ''}`}
        data-testid="notes-split-root"
        data-split="false"
        onDragEnter={onDragEnterRoot}
        onDragLeave={onDragLeaveRoot}
        onDragEnd={onDragEnd}
      >
        <div
          className={`notes-split-single-zones absolute inset-0 z-20 flex${vaultDrag ? ' notes-split-single-zones-active' : ''}`}
        >
          <div
            className={`notes-split-drop-half ${vaultDrag && hoverSide === 'left' ? 'notes-split-drop-half-active' : ''}`}
            data-testid="notes-split-drop-left"
            onDragEnter={(e) => {
              acceptNoteDrag(e)
              setHoverSide('left')
            }}
            onDragOver={acceptNoteDrag}
            onDragLeave={() => setHoverSide((p) => (p === 'left' ? null : p))}
            onDrop={(e) => onDrop(e, 'left')}
          />
          <div
            className={`notes-split-drop-half ${vaultDrag && hoverSide === 'right' ? 'notes-split-drop-half-active' : ''}`}
            data-testid="notes-split-drop-right"
            onDragEnter={(e) => {
              acceptNoteDrag(e)
              setHoverSide('right')
            }}
            onDragOver={acceptNoteDrag}
            onDragLeave={() => setHoverSide((p) => (p === 'right' ? null : p))}
            onDrop={(e) => onDrop(e, 'right')}
          />
        </div>
        {vaultDrag ? (
          <div className="notes-split-drag-hint pointer-events-none absolute inset-x-0 top-2 z-30 text-center text-xs text-[var(--uv-text-muted)]">
            Drop on left or right half to split
          </div>
        ) : null}
        <div className="notes-editor-body relative z-10 flex min-h-0 flex-1 flex-col" data-testid="notes-editor">
          {leftEditor}
        </div>
      </div>
    )
  }

  const leftPct = `${splitRatio * 100}%`
  const rightPct = `${(1 - splitRatio) * 100}%`

  return (
    <div
      className={`notes-split-root notes-split-dual relative flex min-h-0 flex-1${vaultDrag ? ' notes-split-dragging' : ''}`}
      data-testid="notes-split-root"
      data-split="true"
      onDragEnter={onDragEnterRoot}
      onDragLeave={onDragLeaveRoot}
      onDragEnd={onDragEnd}
    >
      <section
        className="notes-split-pane notes-split-pane-left relative flex min-h-0 min-w-0 flex-col"
        style={{ flex: `0 0 ${leftPct}` }}
        data-testid="notes-editor-left"
      >
        {dropOverlay('left')}
        {leftHeader}
        <div className="notes-editor-body flex min-h-0 flex-1 flex-col">{leftEditor}</div>
      </section>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize split panes"
        className="notes-split-resize z-20 w-1 shrink-0 cursor-col-resize hover:bg-[var(--uv-accent-dim)]"
        data-testid="notes-split-resize"
        onMouseDown={onResizeStart}
      />

      <section
        className="notes-split-pane notes-split-pane-right relative flex min-h-0 min-w-0 flex-col border-l border-[var(--uv-border)]"
        style={{ flex: `0 0 ${rightPct}` }}
        data-testid="notes-editor-right"
      >
        {dropOverlay('right')}
        {rightHeader}
        <div className="notes-editor-body flex min-h-0 flex-1 flex-col">{rightEditor}</div>
      </section>
    </div>
  )
}
