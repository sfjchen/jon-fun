'use client'

import { useCallback, useRef } from 'react'
import type { PenPoint, ReaderPenStroke } from '@/lib/reader/chapter-annotations'
import { newPenStroke } from '@/lib/reader/chapter-annotations'

type ReaderPenLayerProps = {
  active: boolean
  strokes: ReaderPenStroke[]
  color: string
  /** Called when a stroke is completed. */
  onStrokeEnd: (stroke: ReaderPenStroke) => void
  /** For anchoring: resolve block under first point. */
  getBlockIdAtPoint: (clientX: number, clientY: number) => string | null
  /** Root to measure (reading column). */
  rootRef: React.RefObject<HTMLElement | null>
}

function normPoint(el: DOMRect, clientX: number, clientY: number): PenPoint {
  const w = Math.max(1, el.width)
  const h = Math.max(1, el.height)
  return { x: (clientX - el.left) / w, y: (clientY - el.top) / h }
}

export function ReaderPenLayer({ active, strokes, color, onStrokeEnd, getBlockIdAtPoint, rootRef }: ReaderPenLayerProps) {
  const currentRef = useRef<{ points: PenPoint[]; blockId: string | null } | null>(null)
  const width = 2.2

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!active) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const p = normPoint(rect, e.clientX, e.clientY)
      const blockId = getBlockIdAtPoint(e.clientX, e.clientY) ?? 'unknown'
      currentRef.current = { points: [p], blockId }
    },
    [active, getBlockIdAtPoint, rootRef],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const cur = currentRef.current
      if (!cur || !active) return
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      cur.points.push(normPoint(rect, e.clientX, e.clientY))
    },
    [active, rootRef],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const cur = currentRef.current
      currentRef.current = null
      if (!cur || !active || cur.points.length < 1) return
      const blockId = cur.blockId
      if (!blockId || blockId === 'unknown') return
      const y = cur.points[0]!.y
      const stroke = newPenStroke(blockId, cur.points, color, width, y)
      onStrokeEnd(stroke)
      e.preventDefault()
    },
    [active, color, onStrokeEnd],
  )

  if (!active && strokes.length === 0) return null

  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="reader-pen-layer pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
      aria-hidden
    >
      <title>Hand-drawn marks</title>
      {strokes.map((s) => (
        <polyline
          key={s.id}
          fill="none"
          vectorEffect="non-scaling-stroke"
          stroke={s.color}
          strokeWidth={Math.max(0.002, s.width * 0.001)}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={s.points.map((p) => `${p.x} ${p.y}`).join(' ')}
        />
      ))}
      {active ? (
        <rect
          x="0"
          y="0"
          width="1"
          height="1"
          fill="transparent"
          className="pointer-events-auto cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      ) : null}
    </svg>
  )
}
