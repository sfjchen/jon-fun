'use client'

/*
 * Site-wide undo bar that replaces "Are you sure?" pop-ups. A caller makes its change visible at once and passes
 * `undoable` the step that makes it final, which runs after 6 seconds, when a newer undoable replaces it, or when
 * the page closes. Undo cancels that step and puts the change back. The bar sits at the bottom center and announces
 * itself to screen readers.
 */
import { useEffect, useSyncExternalStore } from 'react'

type Pending = {
  id: number
  message: string
  commit: () => void
  undo: () => void
  timer: ReturnType<typeof setTimeout>
}

let pending: Pending | null = null
let seq = 0
const listeners = new Set<() => void>()

/**
 * Tells the mounted bar to redraw.
 */
function emit() {
  listeners.forEach((l) => l())
}

/**
 * Runs the pending change's final step now, if there is one, and clears the bar.
 */
function flush() {
  const p = pending
  if (!p) return
  clearTimeout(p.timer)
  pending = null
  emit()
  p.commit()
}

/**
 * Shows the bar for a change the caller already made visible. `commit` makes it final (a delete request, a shared
 * edit) and `undo` restores what the caller changed. Leave `commit` empty when the change is already final locally.
 */
export function undoable(message: string, { commit = () => {}, undo }: { commit?: () => void; undo: () => void }) {
  flush()
  const id = ++seq
  pending = { id, message, commit, undo, timer: setTimeout(() => pending?.id === id && flush(), 6000) }
  emit()
}

/**
 * Renders the pending change's message with an Undo button. Mounted once in the root layout.
 */
export default function UndoBar() {
  const p = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => pending,
    () => null,
  )
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
      {p && (
        <div
          key={p.id}
          className={
            'pointer-events-auto flex items-center gap-4 rounded-xl bg-[var(--ink-text)] py-2.5 pr-2.5 pl-4 font-sans text-sm ' +
            'text-[var(--ink-bg)] shadow-xl'
          }
        >
          <span>{p.message}</span>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 font-semibold hover:bg-white/15"
            onClick={() => {
              clearTimeout(p.timer)
              pending = null
              emit()
              p.undo()
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
