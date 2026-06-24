'use client'

import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'

type NotesTableMenuProps = {
  editor: Editor | null
}

function TableBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault()
        if (!disabled) onClick()
      }}
      className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--uv-text-secondary)] transition-colors hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export default function NotesTableMenu({ editor }: NotesTableMenuProps) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="notesTableMenu"
      shouldShow={({ editor: ed }) => ed.isActive('table')}
      className="flex max-w-[min(100vw-2rem,28rem)] flex-wrap items-center gap-0.5 rounded-lg border border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-1 py-0.5 shadow-md"
      options={{ placement: 'top' }}
      data-testid="notes-table-menu"
    >
      <TableBtn title="Add row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
        +↑ row
      </TableBtn>
      <TableBtn title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
        +↓ row
      </TableBtn>
      <TableBtn title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
        − row
      </TableBtn>
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <TableBtn title="Add column left" onClick={() => editor.chain().focus().addColumnBefore().run()}>
        +← col
      </TableBtn>
      <TableBtn title="Add column right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        +→ col
      </TableBtn>
      <TableBtn title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
        − col
      </TableBtn>
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <TableBtn
        title="Toggle header row"
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
      >
        Header
      </TableBtn>
      <TableBtn
        title="Merge cells"
        disabled={!editor.can().mergeCells()}
        onClick={() => editor.chain().focus().mergeCells().run()}
      >
        Merge
      </TableBtn>
      <TableBtn
        title="Split cell"
        disabled={!editor.can().splitCell()}
        onClick={() => editor.chain().focus().splitCell().run()}
      >
        Split
      </TableBtn>
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <TableBtn
        title="Delete table"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        Delete table
      </TableBtn>
    </BubbleMenu>
  )
}
