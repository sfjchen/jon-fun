'use client'

/*
 * Shared hover tooltip for laptops and keyboards. Mouse hover or keyboard focus shows a small dark card above the
 * element at once, unlike the browser's slow title tooltip. Touch taps skip it, since a tap already acts on the
 * element. Each component keeps 1 tooltip and binds any number of elements to it.
 */
import { useEffect, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'

type Tip = { node: ReactNode; x: number; y: number }

/**
 * Returns `on(content)`, which gives an element the hover and focus handlers, and `el`, the tooltip to render once
 * anywhere in the component. Scrolling hides the tooltip, since it is placed against the viewport.
 */
export function useHoverTip() {
  const [tip, setTip] = useState<Tip | null>(null)
  useEffect(() => {
    if (!tip) return
    const hide = () => setTip(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [tip])
  const show = (node: ReactNode) => (e: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const pointer = (e as PointerEvent).pointerType
    if (pointer ? pointer !== 'mouse' : !e.currentTarget.matches(':focus-visible')) return
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ node, x: Math.min(Math.max(r.left + r.width / 2, 128), window.innerWidth - 128), y: r.top })
  }
  const hide = () => setTip(null)
  const on = (node: ReactNode) => ({ onPointerEnter: show(node), onPointerLeave: hide, onFocus: show(node), onBlur: hide })
  const el = tip && (
    <div
      aria-hidden
      className={'pointer-events-none fixed z-[60] max-w-60 -translate-x-1/2 -translate-y-full rounded-lg bg-[var(--ink-text)] ' +
        'px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-[var(--ink-bg)] shadow-lg'}
      style={{ left: tip.x, top: tip.y - 6 }}
    >
      {tip.node}
    </div>
  )
  return { on, el }
}
