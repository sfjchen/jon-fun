'use client'

import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import { NOTES_FONT_SIZES } from '@/lib/notes/tiptap/extensions'

type NotesBubbleMenuProps = {
  editor: Editor | null
}

function MenuBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active: boolean
  title: string
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
      className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
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

export default function NotesBubbleMenu({ editor }: NotesBubbleMenuProps) {
  if (!editor) return null

  const size = currentFontSize(editor)

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed }) => !ed.isActive('table')}
      className="flex flex-wrap items-center gap-0.5 rounded-lg border border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-1 py-0.5 shadow-md"
      options={{ placement: 'top' }}
    >
      <label className="sr-only" htmlFor="notes-font-size-menu">
        Font size
      </label>
      <select
        id="notes-font-size-menu"
        value={size}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const px = e.target.value
          if (px === '16px') editor.chain().focus().unsetFontSize().run()
          else editor.chain().focus().setFontSize(px).run()
        }}
        className="max-w-[4.5rem] rounded border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-1 py-0.5 text-[11px] text-[var(--uv-text-primary)]"
        title="Font size"
      >
        {NOTES_FONT_SIZES.map((px) => (
          <option key={px} value={px}>
            {parseInt(px, 10)}
          </option>
        ))}
      </select>
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <MenuBtn
        title="Bold (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </MenuBtn>
      <MenuBtn
        title="Italic (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </MenuBtn>
      <MenuBtn
        title="Underline (Ctrl+U)"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </MenuBtn>
      <MenuBtn
        title="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </MenuBtn>
      <MenuBtn
        title="Code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        {'</>'}
      </MenuBtn>
    </BubbleMenu>
  )
}
