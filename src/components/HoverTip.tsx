'use client'

/*
 * Shared hover tooltip for laptops, keyboards and phones. Mouse hover or keyboard focus shows a small dark card above
 * the element at once, unlike the browser's slow title tooltip. On touch, a tap still acts on the element and a press
 * held for half a second shows the card instead, which stays until the next touch. Each component keeps 1 tooltip
 * and binds any number of elements to it.
 */
import { useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'

type Tip = { node: ReactNode; x: number; y: number }

/**
 * Returns `on(content)`, which gives an element the hover and focus handlers, and `el`, the tooltip to render once
 * anywhere in the component. Scrolling hides the tooltip, since it is placed against the viewport.
 */
export function useHoverTip() {
  const [tip, setTip] = useState<Tip | null>(null)
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
  const held = useRef(false)
  useEffect(() => {
    if (!tip) return
    const hide = () => setTip(null)
    window.addEventListener('scroll', hide, true)
    // A long-pressed card stays up until the next touch anywhere.
    const touch = (e: globalThis.PointerEvent) => e.pointerType !== 'mouse' && !held.current && hide()
    document.addEventListener('pointerdown', touch, true)
    return () => {
      window.removeEventListener('scroll', hide, true)
      document.removeEventListener('pointerdown', touch, true)
    }
  }, [tip])
  const place = (node: ReactNode, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setTip({ node, x: Math.min(Math.max(r.left + r.width / 2, 128), window.innerWidth - 128), y: r.top })
  }
  const show = (node: ReactNode) => (e: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const pointer = (e as PointerEvent).pointerType
    if (pointer ? pointer !== 'mouse' : !e.currentTarget.matches(':focus-visible')) return
    place(node, e.currentTarget)
  }
  const hide = () => setTip(null)
  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }
  const on = (node: ReactNode) => ({
    onPointerEnter: show(node),
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      cancel()
      if (e.pointerType === 'mouse') hide()
    },
    onFocus: show(node),
    onBlur: hide,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return
      held.current = false
      const el = e.currentTarget
      press.current = {
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(() => {
          held.current = true
          place(node, el)
          navigator.vibrate?.(8)
        }, 450),
      }
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const p = press.current
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // The tap that ends a long press only shows the card, so it never also opens the element.
    onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!held.current) return
      held.current = false
      e.preventDefault()
      e.stopPropagation()
    },
    onContextMenu: (e: { preventDefault: () => void }) => held.current && e.preventDefault(),
  })
  const el = tip && (
    <div
      aria-hidden
      className={
        'pointer-events-none fixed z-[60] max-w-60 -translate-x-1/2 -translate-y-full rounded-lg bg-[var(--ink-text)] ' +
        'px-2.5 py-1.5 text-left text-xs leading-snug font-normal text-[var(--ink-bg)] shadow-lg'
      }
      style={{ left: tip.x, top: tip.y - 6 }}
    >
      {tip.node}
    </div>
  )
  return { on, el }
}
