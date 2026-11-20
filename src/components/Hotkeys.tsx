'use client'

/**
 * Runs the site-wide `data-hotkey` shortcuts: any button or link that lists a key in `data-hotkey` (space separated,
 * with `Space` for the space bar) is clicked when that key is pressed. While a modal dialog is open only its own
 * controls answer.
 */

import { useHotkeys } from '@/lib/keyboard'

/**
 * Listens for key presses and clicks the first visible, enabled control that claims the key.
 */
export default function Hotkeys() {
  useHotkeys((k) => {
    const name = k === ' ' ? 'Space' : k
    const root: ParentNode = document.querySelector('[aria-modal="true"]') ?? document
    for (const el of root.querySelectorAll<HTMLElement>('[data-hotkey]')) {
      if (!el.dataset.hotkey!.split(' ').includes(name) || (el as HTMLButtonElement).disabled || !el.getClientRects().length) continue
      el.click()
      return true
    }
  }, true, true)
  return null
}
