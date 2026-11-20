'use client'

/**
 * Runs the site-wide keyboard layer, driven by 2 attributes so a page opts in without its own listener.
 * `data-hotkey` lists the keys (space separated, with `Space` for the space bar) that click a button or link.
 * `data-arrows` marks a group of buttons or links the arrow keys walk by position, with Home and End for the ends.
 * `data-arrows="grab"` also takes the first arrow press when nothing in the group has focus yet.
 * While a modal dialog is open only its own controls answer.
 */

import { useHotkeys } from '@/lib/keyboard'

/**
 * Moves focus from the focused item of an arrow group to its nearest neighbour in the pressed direction, and returns
 * whether the key was used.
 */
function rove(root: ParentNode, key: string): boolean {
  const at = document.activeElement as HTMLElement | null
  const group = at?.closest<HTMLElement>('[data-arrows]') ?? root.querySelector<HTMLElement>('[data-arrows="grab"]')
  if (!group || !group.getClientRects().length) return false
  const items = [...group.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')].filter((el) => el.getClientRects().length)
  if (!items.length) return false
  if (!at || !group.contains(at)) return items[0]!.focus(), true
  if (key === 'Home' || key === 'End') return items[key === 'Home' ? 0 : items.length - 1]!.focus(), true
  const mid = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2] as const
  }
  const [x, y] = mid(at), across = key === 'ArrowLeft' || key === 'ArrowRight', sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1
  let best: HTMLElement | null = null, cost = Infinity
  for (const el of items) {
    const [ex, ey] = mid(el), along = ((across ? ex - x : ey - y)) * sign, off = Math.abs(across ? ey - y : ex - x)
    // Counts sideways drift 3 times over, so the arrows stay in the row or column where they can.
    if (el !== at && along > 4 && along + off * 3 < cost) { best = el; cost = along + off * 3 }
  }
  best?.focus()
  return true
}

/**
 * Listens for key presses, walking arrow groups and clicking the first visible, enabled control that claims a key.
 */
export default function Hotkeys() {
  useHotkeys((k) => {
    const root: ParentNode = document.querySelector('[aria-modal="true"]') ?? document
    if (k.startsWith('Arrow') || k === 'Home' || k === 'End') return rove(root, k)
    const name = k === ' ' ? 'Space' : k
    for (const el of root.querySelectorAll<HTMLElement>('[data-hotkey]')) {
      if (!el.dataset.hotkey!.split(' ').includes(name) || (el as HTMLButtonElement).disabled || !el.getClientRects().length) continue
      el.click()
      return true
    }
  }, true, true)
  return null
}
