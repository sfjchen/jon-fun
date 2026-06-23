'use client'

import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'

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

export default function NotesBubbleMenu({ editor }: NotesBubbleMenuProps) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-0.5 rounded-lg border border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-1 py-0.5 shadow-md"
      options={{ placement: 'top' }}
    >
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
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <MenuBtn
        title="Bullet list (Ctrl+Shift+8)"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </MenuBtn>
      <MenuBtn
        title="Numbered list (Ctrl+Shift+7)"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </MenuBtn>
    </BubbleMenu>
  )
}
