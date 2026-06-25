'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import { PluginKey } from '@tiptap/pm/state'
import { copyTableAsCsv, tableCellCount } from '@/lib/notes/tiptap/tableExtract'

const TABLE_MENU_PLUGIN_KEY = new PluginKey('notesTableMenu')

type NotesTableMenuProps = {
  editor: Editor | null
}

type CellAlign = 'left' | 'center' | 'right'

function TableBtn({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
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
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-[var(--uv-accent-dim)] text-[var(--uv-accent-strong)]'
          : 'text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)] hover:text-[var(--uv-text-primary)]'
      }`}
    >
      {children}
    </button>
  )
}

function currentCellAlign(editor: Editor): CellAlign | null {
  const attrs = editor.getAttributes('tableCell')
  const headerAttrs = editor.getAttributes('tableHeader')
  const align = (attrs.align ?? headerAttrs.align) as CellAlign | undefined
  return align ?? null
}

export default function NotesTableMenu({ editor }: NotesTableMenuProps) {
  const [copyOk, setCopyOk] = useState(false)
  const menuOpenRef = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const hideMenu = useCallback(() => {
    if (!editor || !menuOpenRef.current) return
    menuOpenRef.current = false
    editor.view.dispatch(editor.state.tr.setMeta(TABLE_MENU_PLUGIN_KEY, 'hide'))
  }, [editor])

  const showMenu = useCallback(() => {
    if (!editor) return
    menuOpenRef.current = true
    editor.view.dispatch(editor.state.tr.setMeta(TABLE_MENU_PLUGIN_KEY, 'show'))
  }, [editor])

  const shouldShow = useCallback(
    ({ editor: ed }: { editor: Editor }) => menuOpenRef.current && ed.isActive('table'),
    [],
  )

  const setAlign = useCallback(
    (align: CellAlign) => {
      editor?.chain().focus().setCellAttribute('align', align).run()
    },
    [editor],
  )

  const onCopyCsv = useCallback(async () => {
    if (!editor) return
    const ok = await copyTableAsCsv(editor)
    if (ok) {
      setCopyOk(true)
      window.setTimeout(() => setCopyOk(false), 1500)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return

    const onPointerDown = (e: PointerEvent) => {
      if (!menuOpenRef.current) return
      if (menuRef.current?.contains(e.target as Node)) return
      hideMenu()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideMenu()
    }

    const prevHandle = editor.options.editorProps?.handleDOMEvents ?? {}
    editor.setOptions({
      editorProps: {
        handleDOMEvents: {
          ...prevHandle,
          contextmenu: (_view, event) => {
            if (!editor.isActive('table')) return false
            event.preventDefault()
            showMenu()
            return true
          },
        },
      },
    })

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      editor.setOptions({
        editorProps: {
          handleDOMEvents: prevHandle,
        },
      })
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [editor, showMenu, hideMenu])

  if (!editor) return null

  const dims = tableCellCount(editor)
  const align = currentCellAlign(editor)

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      pluginKey={TABLE_MENU_PLUGIN_KEY}
      shouldShow={shouldShow}
      updateDelay={0}
      className="flex max-w-[min(100vw-2rem,36rem)] flex-wrap items-center gap-0.5 rounded-lg border border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-1 py-0.5 shadow-md"
      options={{ placement: 'top' }}
      data-testid="notes-table-menu"
    >
      {dims ? (
        <span
          className="px-1 text-[10px] text-[var(--uv-text-muted)]"
          data-testid="notes-table-dims"
        >
          {dims.rows}×{dims.cols}
        </span>
      ) : null}
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
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
        H row
      </TableBtn>
      <TableBtn
        title="Toggle header column"
        onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
      >
        H col
      </TableBtn>
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <TableBtn title="Align left" active={align === 'left'} onClick={() => setAlign('left')}>
        ⬅
      </TableBtn>
      <TableBtn title="Align center" active={align === 'center'} onClick={() => setAlign('center')}>
        ↔
      </TableBtn>
      <TableBtn title="Align right" active={align === 'right'} onClick={() => setAlign('right')}>
        ➡
      </TableBtn>
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <TableBtn
        title="Merge selected cells (select multiple with Shift+click)"
        disabled={!editor.can().mergeCells()}
        onClick={() => editor.chain().focus().mergeCells().run()}
      >
        Merge
      </TableBtn>
      <TableBtn
        title="Split merged cell"
        disabled={!editor.can().splitCell()}
        onClick={() => editor.chain().focus().splitCell().run()}
      >
        Split
      </TableBtn>
      <TableBtn title="Fix table structure" onClick={() => editor.chain().focus().fixTables().run()}>
        Fix
      </TableBtn>
      <span className="mx-0.5 h-4 w-px bg-[var(--uv-border)]" />
      <TableBtn title="Copy table as CSV" onClick={() => void onCopyCsv()}>
        {copyOk ? 'Copied!' : 'CSV'}
      </TableBtn>
      <TableBtn title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
        Delete
      </TableBtn>
    </BubbleMenu>
  )
}
