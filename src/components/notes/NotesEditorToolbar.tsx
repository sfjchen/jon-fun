'use client'

import type { Editor } from '@tiptap/core'
import { NOTES_FONT_SIZES } from '@/lib/notes/tiptap/extensions'

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
  active: boolean
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

export default function NotesEditorToolbar({ editor }: NotesEditorToolbarProps) {
  if (!editor) return null

  const size = currentFontSize(editor)

  return (
    <div
      className="notes-editor-toolbar flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--uv-border)] px-3 py-1 sm:px-4"
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
    </div>
  )
}
