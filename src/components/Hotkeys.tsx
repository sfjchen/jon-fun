'use client'

/**
 * Runs the site-wide keyboard layer, driven by 2 attributes so a page opts in without its own listener.
 * `data-hotkey` lists the keys (space separated, with `Space` for the space bar) that click a button or link.
 * `data-arrows` marks a group of buttons or links the arrow keys walk by position, with Home and End for the ends.
 * `data-arrows="grab"` also takes the first arrow press when nothing in the group has focus yet.
 * While a modal dialog is open only its own controls answer.
 * Hovering a control with the mouse, or reaching it with Tab, shows its keys in a small chip. `data-keys` gives a
 * control the same chip when its keys are handled by its own page instead of `data-hotkey`. Touch shows no chip.
 */

import { useEffect, useState } from 'react'
import { useHotkeys } from '@/lib/keyboard'

/** Key names as printed in the chip. Other keys print as they are, with single letters in capitals. */
const KEY_LABEL: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  Backspace: '⌫',
}

/**
 * Moves focus from the focused item of an arrow group to its nearest neighbour in the pressed direction, and returns
 * whether the key was used.
 */
function rove(root: ParentNode, key: string): boolean {
  const at = document.activeElement as HTMLElement | null
  const group = at?.closest<HTMLElement>('[data-arrows]') ?? root.querySelector<HTMLElement>('[data-arrows="grab"]')
  if (!group || !group.getClientRects().length) return false
  const items = [...group.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')].filter(
    (el) => el.getClientRects().length,
  )
  if (!items.length) return false
  if (!at || !group.contains(at)) return (items[0]!.focus(), true)
  if (key === 'Home' || key === 'End') return (items[key === 'Home' ? 0 : items.length - 1]!.focus(), true)
  const mid = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2] as const
  }
  const [x, y] = mid(at),
    across = key === 'ArrowLeft' || key === 'ArrowRight',
    sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1
  let best: HTMLElement | null = null,
    cost = Infinity
  for (const el of items) {
    const [ex, ey] = mid(el),
      along = (across ? ex - x : ey - y) * sign,
      off = Math.abs(across ? ey - y : ex - x)
    // Counts sideways drift 3 times over, so the arrows stay in the row or column where they can.
    if (el !== at && along > 4 && along + off * 3 < cost) {
      best = el
      cost = along + off * 3
    }
  }
  best?.focus()
  return true
}

/**
 * Listens for key presses, walking arrow groups and clicking the first visible, enabled control that claims a key.
 */
export default function Hotkeys() {
  const [hint, setHint] = useState<{ keys: string[]; x: number; y: number } | null>(null)
  // Shows the chip under the hovered or focused control, or above it when there is no room below.
  useEffect(() => {
    let at: HTMLElement | null = null
    const hide = () => {
      at = null
      setHint(null)
    }
    const show = (t: EventTarget | null) => {
      const el = t instanceof Element ? t.closest<HTMLElement>('[data-hotkey],[data-keys]') : null
      if (el === at) return
      if (!el || (el as HTMLButtonElement).disabled) return hide()
      at = el
      const r = el.getBoundingClientRect(),
        keys = (el.dataset.keys ?? el.dataset.hotkey!).split(' ').filter(Boolean)
      setHint({
        keys: keys.map((k) => KEY_LABEL[k] ?? (k.length === 1 ? k.toUpperCase() : k)),
        x: Math.min(Math.max(r.left + r.width / 2, 48), window.innerWidth - 48),
        y: r.bottom + 34 > window.innerHeight ? r.top - 30 : r.bottom + 6,
      })
    }
    const over = (e: PointerEvent) => e.pointerType === 'mouse' && show(e.target)
    const focus = (e: FocusEvent) => (e.target as Element).matches?.(':focus-visible') && show(e.target)
    const on = [
      ['pointerover', over],
      ['focusin', focus],
      ['pointerout', (e: PointerEvent) => e.relatedTarget || hide()],
      ['focusout', hide],
      ['pointerdown', hide],
      ['keydown', hide],
      ['scroll', hide],
    ] as const
    for (const [type, fn] of on) document.addEventListener(type, fn as EventListener, true)
    return () => {
      for (const [type, fn] of on) document.removeEventListener(type, fn as EventListener, true)
    }
  }, [])
  useHotkeys(
    (k) => {
      const root: ParentNode = document.querySelector('[aria-modal="true"]') ?? document
      if ((k.startsWith('Arrow') || k === 'Home' || k === 'End') && rove(root, k)) return true
      const name = k === ' ' ? 'Space' : k
      for (const el of root.querySelectorAll<HTMLElement>('[data-hotkey]')) {
        if (
          !el.dataset.hotkey!.split(' ').includes(name) ||
          (el as HTMLButtonElement).disabled ||
          !el.getClientRects().length
        )
          continue
        el.click()
        return true
      }
    },
    true,
    true,
  )
  return (
    hint && (
      <div
        aria-hidden
        className="pointer-events-none fixed z-[70] flex -translate-x-1/2 items-center gap-1 font-sans text-[11px] leading-none"
        style={{ left: hint.x, top: hint.y }}
      >
        {hint.keys.map((k) => (
          <kbd key={k} className="rounded-md bg-[#1a1a1a] px-1.5 py-1 font-sans font-semibold text-white shadow-md">
            {k}
          </kbd>
        ))}
      </div>
    )
  )
}
