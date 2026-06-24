'use client'

import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import { NOTES_FONT_SIZES } from '@/lib/notes/tiptap/extensions'
import { DEFAULT_TABLE_COLS, DEFAULT_TABLE_ROWS } from '@/lib/notes/tiptap/tableUtils'

type NotesEditorToolbarProps = {
  editor: Editor | null
}

function ToolBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={`rounded px-2 py-0.5 text-sm transition-colors ${
        active
          ? 'bg-[var(--uv-accent-dim)] text-[var(--uv-accent-strong)]'
          : 'text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)]'
      }`}
    >
      {children}
    </button>
  )
}

function currentFontSize(editor: Editor): string {
  const attrs = editor.getAttributes('textStyle')
  return typeof attrs.fontSize === 'string' && attrs.fontSize ? attrs.fontSize : '16px'
}

function TableInsertPopover({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [rows, setRows] = useState(DEFAULT_TABLE_ROWS)
  const [cols, setCols] = useState(DEFAULT_TABLE_COLS)
  const [header, setHeader] = useState(true)

  const insert = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: Math.max(1, rows), cols: Math.max(1, cols), withHeaderRow: header })
      .run()
    onClose()
  }

  return (
    <div
      className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-[var(--uv-border)] bg-[var(--uv-bg-base)] p-3 shadow-lg"
      data-testid="notes-table-insert-popover"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-[11px] font-semibold text-[var(--uv-text-primary)]">Insert table</p>
      <div className="mb-2 flex gap-2">
        <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-[var(--uv-text-muted)]">
          Rows
          <input
            type="number"
            min={1}
            max={20}
            value={rows}
            onChange={(e) => setRows(Number(e.target.value) || 1)}
            className="rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1 text-xs text-[var(--uv-text-primary)]"
            data-testid="notes-table-rows-input"
          />
        </label>
        <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-[var(--uv-text-muted)]">
          Cols
          <input
            type="number"
            min={1}
            max={12}
            value={cols}
            onChange={(e) => setCols(Number(e.target.value) || 1)}
            className="rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-2 py-1 text-xs text-[var(--uv-text-primary)]"
            data-testid="notes-table-cols-input"
          />
        </label>
      </div>
      <label className="mb-3 flex items-center gap-2 text-[11px] text-[var(--uv-text-secondary)]">
        <input
          type="checkbox"
          checked={header}
          onChange={(e) => setHeader(e.target.checked)}
          data-testid="notes-table-header-checkbox"
        />
        Header row
      </label>
      <button
        type="button"
        className="w-full rounded bg-[var(--uv-accent)] px-2 py-1 text-xs font-medium text-white hover:opacity-90"
        data-testid="notes-table-insert-confirm"
        onClick={insert}
      >
        Insert
      </button>
    </div>
  )
}

export default function NotesEditorToolbar({ editor }: NotesEditorToolbarProps) {
  const [tableOpen, setTableOpen] = useState(false)

  if (!editor) return null

  const size = currentFontSize(editor)

  return (
    <div
      className="notes-editor-toolbar relative flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--uv-border)] px-3 py-1 sm:px-4"
      data-testid="notes-editor-toolbar"
    >
      <label className="sr-only" htmlFor="notes-font-size-toolbar">
        Font size
      </label>
      <select
        id="notes-font-size-toolbar"
        data-testid="notes-font-size"
        value={size}
        onChange={(e) => {
          const px = e.target.value
          if (px === '16px') editor.chain().focus().unsetFontSize().run()
          else editor.chain().focus().setFontSize(px).run()
        }}
        className="rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-1.5 py-0.5 text-[11px] text-[var(--uv-text-primary)]"
        title="Font size"
      >
        {NOTES_FONT_SIZES.map((px) => (
          <option key={px} value={px}>
            {parseInt(px, 10)}px
          </option>
        ))}
      </select>
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <ToolBtn
        title="Bold (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </ToolBtn>
      <ToolBtn
        title="Italic (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </ToolBtn>
      <ToolBtn
        title="Underline (Ctrl+U)"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolBtn>
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <div className="relative">
        <ToolBtn
          title="Insert table (Ctrl+Alt+T)"
          active={editor.isActive('table') || tableOpen}
          onClick={() => setTableOpen((o) => !o)}
        >
          <span data-testid="notes-table-insert-btn">▦</span>
        </ToolBtn>
        {tableOpen ? (
          <TableInsertPopover editor={editor} onClose={() => setTableOpen(false)} />
        ) : null}
      </div>
    </div>
  )
}
