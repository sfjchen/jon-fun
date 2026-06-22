'use client'

import { useEffect, useState } from 'react'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/uvimco-notes/prefs'

const items = [
  { sym: 'line?', desc: 'AI explain line (fires on ?)' },
  { sym: 'line??', desc: 'AI explain section' },
  { sym: '>action', desc: 'todo' },
  { sym: '*key', desc: 'highlight' },
  { sym: '~approx', desc: 'estimate' },
]

export default function ShorthandBar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(loadNotesUiPrefs().shorthandOpen ?? false)
  }, [])

  function toggle() {
    setOpen((v) => {
      const next = !v
      saveNotesUiPrefs({ shorthandOpen: next })
      return next
    })
  }

  return (
    <div className="shrink-0 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-4 py-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          data-testid="notes-shorthand-toggle"
          className="rounded px-1.5 py-0.5 text-[11px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)]"
          aria-expanded={open}
        >
          {open ? 'Hide hints' : 'Hints'}
        </button>
        {!open ? (
          <span className="hidden truncate text-[11px] text-[var(--uv-text-muted)] sm:inline">
            line? / line?? · Ctrl+Shift+F search · Ctrl+B/I/U · Ctrl+\ panel
          </span>
        ) : null}
      </div>
      {open ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-[11px] text-[var(--uv-text-secondary)]">
          {items.map((it) => (
            <span key={it.sym}>
              <code className="font-semibold text-[var(--uv-accent-strong)]">{it.sym}</code>
              <span className="ml-1">{it.desc}</span>
            </span>
          ))}
          <span className="ml-auto hidden lg:inline">
            Ctrl+B/I/U bold/italic/underline · Ctrl+Shift+8 bullet · Ctrl+S export · Ctrl+K summarize · Ctrl+\ panel ·
            Ctrl+Shift+N new note · Ctrl+Shift+F search
          </span>
        </div>
      ) : null}
    </div>
  )
}
