'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type ExportMenuProps = {
  onExportMd: () => void
  onExportPdf: () => Promise<void>
  pdfBusy?: boolean | undefined
}

export default function ExportMenu({ onExportMd, onExportPdf, pdfBusy }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <div ref={rootRef} className="relative" data-testid="notes-export-menu">
      <button
        type="button"
        data-testid="notes-export-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded border border-[var(--uv-border)] px-1.5 py-0.5 hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)]"
      >
        Export
        <kbd className="text-[9px] text-[var(--uv-text-muted)]">Ctrl+E</kbd>
        <span className="text-[9px] text-[var(--uv-text-muted)]">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-50 mb-1 min-w-[9rem] rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="notes-export-md"
            onClick={() => {
              onExportMd()
              close()
            }}
            className="block w-full px-3 py-1.5 text-left text-[11px] hover:bg-[var(--uv-bg-hover)]"
          >
            Markdown (.md)
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="notes-export-pdf"
            disabled={pdfBusy}
            onClick={() => {
              void onExportPdf().finally(close)
            }}
            className="block w-full px-3 py-1.5 text-left text-[11px] hover:bg-[var(--uv-bg-hover)] disabled:opacity-50"
          >
            {pdfBusy ? 'PDF…' : 'PDF (.pdf)'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
