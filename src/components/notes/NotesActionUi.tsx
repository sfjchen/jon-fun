'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

/** Hover-reveal row action — always visible on touch (see notes.css `.notes-row-action`). */
export function NotesRowAction({
  label,
  onClick,
  testId,
  danger,
  children = '×',
}: {
  label: string
  onClick: (e: React.MouseEvent) => void
  testId?: string
  danger?: boolean
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
      className={`notes-row-action shrink-0 rounded px-1 text-[10px] leading-none text-[var(--uv-text-muted)] hover:text-red-600 ${
        danger ? 'hover:text-red-600' : 'hover:text-[var(--uv-text-primary)]'
      }`}
    >
      {children}
    </button>
  )
}

export type NotesMenuItem = {
  id: string
  label: string
  danger?: boolean
  onClick: () => void
}

/** Compact ⋯ overflow — primary path for multi-action rows on touch. */
export function NotesOverflowMenu({
  label,
  items,
  testId,
}: {
  label: string
  items: NotesMenuItem[]
  testId?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid={testId}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="notes-row-action rounded px-0.5 text-[10px] leading-none text-[var(--uv-text-muted)] hover:text-[var(--uv-text-primary)]"
      >
        ⋯
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-0.5 min-w-[9rem] rounded border border-[var(--uv-border)] bg-[var(--uv-bg-base)] py-0.5 shadow-md"
          data-testid={testId ? `${testId}-menu` : undefined}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              data-testid={`${testId ?? 'notes-overflow'}-${item.id}`}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                item.onClick()
              }}
              className={`block w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-[var(--uv-bg-hover)] ${
                item.danger ? 'text-red-600' : 'text-[var(--uv-text-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

type NotesContextMenuState = {
  x: number
  y: number
  items: NotesMenuItem[]
  testId?: string
}

/** Floating context menu — right-click (desktop) or long-press (touch) bonus path. */
export function NotesContextMenu({
  state,
  onClose,
}: {
  state: NotesContextMenuState | null
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state) return
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [state, onClose])

  if (!state) return null

  const pad = 8
  const maxX = typeof window !== 'undefined' ? window.innerWidth - 200 : state.x
  const maxY = typeof window !== 'undefined' ? window.innerHeight - 200 : state.y
  const left = Math.min(state.x, maxX - pad)
  const top = Math.min(state.y, maxY - pad)

  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid={state.testId ?? 'notes-context-menu'}
      className="fixed z-[100] min-w-[10rem] rounded border border-[var(--uv-border)] bg-[var(--uv-bg-base)] py-0.5 shadow-lg"
      style={{ left, top }}
    >
      {state.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          data-testid={`notes-ctx-${item.id}`}
          onClick={() => {
            onClose()
            item.onClick()
          }}
          className={`block w-full px-3 py-1.5 text-left text-[12px] hover:bg-[var(--uv-bg-hover)] ${
            item.danger ? 'text-red-600' : 'text-[var(--uv-text-primary)]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

const LONG_PRESS_MS = 500

/** Open the same menu on contextmenu (desktop) or long-press (touch). */
export function useNotesContextTrigger(
  buildItems: (e: { clientX: number; clientY: number }) => NotesMenuItem[],
) {
  const [state, setState] = useState<NotesContextMenuState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const posRef = useRef({ x: 0, y: 0 })

  const close = useCallback(() => setState(null), [])

  const openAt = useCallback(
    (clientX: number, clientY: number, testId?: string) => {
      const items = buildItems({ clientX, clientY })
      if (items.length === 0) return
      setState(
        testId
          ? { x: clientX, y: clientY, items, testId }
          : { x: clientX, y: clientY, items },
      )
    },
    [buildItems],
  )

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      openAt(e.clientX, e.clientY)
    },
    [openAt],
  )

  const touchHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      posRef.current = { x: t.clientX, y: t.clientY }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        openAt(posRef.current.x, posRef.current.y)
      }, LONG_PRESS_MS)
    },
    onTouchEnd: () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    onTouchMove: () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { state, close, onContextMenu, touchHandlers, openAt }
}
