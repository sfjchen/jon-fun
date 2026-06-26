'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  buildNotesExtensions,
  NOTES_EDITOR_PLACEHOLDER,
  normalizeNotesLineHeight,
} from '@/lib/notes/tiptap/extensions'
import type { NoteAttachmentStorage } from '@/lib/notes/tiptap/noteAttachment'
import {
  markdownFromEditor,
  mergeTodoLinesIntoMarkdown,
  plainTextFromEditor,
  postprocessTodoMarkdown,
  preprocessTodoMarkdown,
  scrollToLineIndex,
} from '@/lib/notes/tiptap/editorCoords'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/notes/prefs'
import { normalizeNotesMarkdown } from '@/lib/notes/tiptap/markdownNormalize'
import { refreshShorthandDecorations } from '@/lib/notes/tiptap/shorthandDecorations'
import { scheduleTriggerCheck } from '@/lib/notes/tiptap/triggerPlugin'
import { insertNoteAttachmentsFromFiles } from '@/lib/notes/tiptap/pasteFiles'
import type { Screenshot, TriggerType } from '@/lib/notes/types'
import NotesEditorToolbar from './NotesEditorToolbar'
import NotesTableMenu from './NotesTableMenu'
import { NotesContextMenu, type NotesMenuItem } from './NotesActionUi'
import { isModD } from '@/lib/keyboard'
import { selectedTextFromEditor } from '@/lib/notes/tiptap/editorCoords'
import { buildEditorContextMenuItems } from './notesEditorContextMenu'

export type NoteEditorHandle = {
  scrollToLine: (lineIndex: number) => void
}

type TiptapNoteEditorProps = {
  sessionId: string
  value: string
  screenshots: Record<string, Screenshot>
  onChange: (val: string) => void
  onTrigger: (type: TriggerType, query: string, context: string) => void
  activeTriggerQuery: string | null
  onAttachmentAdd: (attachment: Screenshot) => void
  onAttachmentUpdate: (id: string, patch: Partial<Screenshot>) => void
  onLookupSelection?: (query: string, type: TriggerType) => void
  onAddSelectionToDictionary?: (term: string) => boolean
  onArchiveTodoLine?: (lineIndex: number) => void
  onRestoreTodoLine?: (lineIndex: number) => void
}

function editorMarkdown(ed: import('@tiptap/core').Editor): string {
  return normalizeNotesMarkdown(postprocessTodoMarkdown(markdownFromEditor(ed)))
}

const TiptapNoteEditor = forwardRef<NoteEditorHandle, TiptapNoteEditorProps>(function TiptapNoteEditor(
  {
    sessionId,
    value,
    screenshots,
    onChange,
    onTrigger,
    activeTriggerQuery,
    onAttachmentAdd,
    onAttachmentUpdate,
    onLookupSelection,
    onAddSelectionToDictionary,
    onArchiveTodoLine,
    onRestoreTodoLine,
  },
  ref,
) {
  const lastFiredRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emittedMarkdownRef = useRef<string | null>(null)
  const sessionIdRef = useRef(sessionId)
  const onTriggerStable = useCallback(onTrigger, [onTrigger])
  const activeQueryRef = useRef(activeTriggerQuery)
  activeQueryRef.current = activeTriggerQuery
  const screenshotsRef = useRef(screenshots)
  screenshotsRef.current = screenshots

  const onAttachmentAddRef = useRef(onAttachmentAdd)
  const onAttachmentUpdateRef = useRef(onAttachmentUpdate)
  onAttachmentAddRef.current = onAttachmentAdd
  onAttachmentUpdateRef.current = onAttachmentUpdate

  const onLookupSelectionRef = useRef(onLookupSelection)
  const onAddDictionaryRef = useRef(onAddSelectionToDictionary)
  const onArchiveTodoLineRef = useRef(onArchiveTodoLine)
  const onRestoreTodoLineRef = useRef(onRestoreTodoLine)
  onLookupSelectionRef.current = onLookupSelection
  onAddDictionaryRef.current = onAddSelectionToDictionary
  onArchiveTodoLineRef.current = onArchiveTodoLine
  onRestoreTodoLineRef.current = onRestoreTodoLine

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: NotesMenuItem[] } | null>(null)
  const [lineHeight, setLineHeight] = useState(() => {
    const saved = loadNotesUiPrefs().lineHeight
    const normalized = normalizeNotesLineHeight(saved)
    if (saved && saved !== normalized) saveNotesUiPrefs({ lineHeight: normalized })
    return normalized
  })
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchPosRef = useRef({ x: 0, y: 0 })
  const editorInstanceRef = useRef<import('@tiptap/core').Editor | null>(null)

  const extensions = useMemo(
    () =>
      buildNotesExtensions({
        placeholder: NOTES_EDITOR_PLACEHOLDER,
        getActiveQuery: () => activeQueryRef.current,
      }),
    [],
  )

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions,
    content: preprocessTodoMarkdown(value),
    contentType: 'markdown',
    onUpdate: ({ editor: ed }) => {
      const plain = plainTextFromEditor(ed)
      const md = postprocessTodoMarkdown(markdownFromEditor(ed))
      const merged = mergeTodoLinesIntoMarkdown(plain, md)
      emittedMarkdownRef.current = normalizeNotesMarkdown(merged)
      onChange(merged)
      scheduleTriggerCheck(ed, debounceRef, onTriggerStable, lastFiredRef)
    },
    editorProps: {
      attributes: {
        class: 'tiptap notes-tiptap min-h-full px-4 py-3 focus:outline-none',
        spellcheck: 'false',
        autocorrect: 'off',
        autocomplete: 'off',
        autocapitalize: 'off',
      },
    },
  })

  editorInstanceRef.current = editor

  const handleLineHeightChange = useCallback((lh: string) => {
    setLineHeight(lh)
    saveNotesUiPrefs({ lineHeight: lh })
  }, [])

  useEffect(() => {
    if (!editor) return
    editor.view.dom.style.setProperty('--notes-line-height', lineHeight)
  }, [editor, lineHeight])

  const openEditorContextMenu = useCallback((clientX: number, clientY: number) => {
    const ed = editorInstanceRef.current
    if (!ed) return
    const lookup = onLookupSelectionRef.current
    const archive = onArchiveTodoLineRef.current
    const restore = onRestoreTodoLineRef.current
    if (!lookup || !archive || !restore) return
    const items = buildEditorContextMenuItems(ed, lookup, archive, restore)
    if (items.length === 0) return
    setCtxMenu({ x: clientX, y: clientY, items })
  }, [])

  useImperativeHandle(ref, () => ({
    scrollToLine(lineIndex: number) {
      if (!editor) return
      scrollToLineIndex(editor, lineIndex)
    },
  }))

  useEffect(() => {
    if (!editor) return
    const storage = editor.storage.noteAttachment as NoteAttachmentStorage
    storage.screenshots = screenshotsRef.current
    storage.onAdd = (a) => onAttachmentAddRef.current(a)
    storage.onUpdate = (id, patch) => onAttachmentUpdateRef.current(id, patch)
    editor.view.dispatch(editor.state.tr)
  }, [editor, screenshots, onAttachmentAdd, onAttachmentUpdate])

  /** Note switch: swap content in-place (avoid remounting Tiptap / extensions). */
  useEffect(() => {
    if (!editor || sessionIdRef.current === sessionId) return
    sessionIdRef.current = sessionId
    lastFiredRef.current = null
    emittedMarkdownRef.current = null
    editor.commands.blur()
    const next = normalizeNotesMarkdown(value)
    emittedMarkdownRef.current = next
    editor.commands.setContent(preprocessTodoMarkdown(value), {
      contentType: 'markdown',
      emitUpdate: false,
    })
    editor.commands.focus('start')
  }, [sessionId, value, editor])

  useEffect(() => {
    if (!editor) return
    const next = normalizeNotesMarkdown(value)
    if (emittedMarkdownRef.current !== null && emittedMarkdownRef.current === next) return

    const current = editorMarkdown(editor)
    if (current === next) {
      emittedMarkdownRef.current = next
      return
    }

    // Local editor wins while focused — remote/sync must not reset mid-keystroke.
    if (editor.isFocused) return

    const { from, to } = editor.state.selection
    emittedMarkdownRef.current = next
    editor.commands.setContent(preprocessTodoMarkdown(value), {
      contentType: 'markdown',
      emitUpdate: false,
    })
    const docSize = editor.state.doc.content.size
    const safeFrom = Math.min(from, docSize)
    const safeTo = Math.min(to, docSize)
    editor.commands.setTextSelection({ from: safeFrom, to: safeTo })
  }, [value, editor])

  useEffect(() => {
    if (!editor || typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('notesE2e') !== '1') return
    const w = window as Window & {
      __notesE2eInsertCsv?: (csv: string, filename?: string) => Promise<boolean>
      __notesE2eSelectAttachment?: (attachmentId: string) => boolean
      __notesE2eEditor?: () => typeof editor
      __notesE2eGetMarkdown?: () => string
    }
    w.__notesE2eInsertCsv = async (csv, filename = 'e2e.csv') => {
      const storage = editor.storage.noteAttachment as NoteAttachmentStorage
      if (!storage.onAdd) return false
      const file = new File([csv], filename, { type: 'text/csv' })
      const ids = await insertNoteAttachmentsFromFiles(editor, [file], storage.onAdd)
      return ids.length > 0
    }
    w.__notesE2eSelectAttachment = (attachmentId) => {
      let targetPos: number | null = null
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'noteAttachment' && node.attrs.attachmentId === attachmentId) {
          targetPos = pos
          return false
        }
      })
      if (targetPos == null) return false
      editor.chain().focus().setNodeSelection(targetPos).run()
      return true
    }
    w.__notesE2eEditor = () => editor
    w.__notesE2eGetMarkdown = () => editor.getMarkdown()
    return () => {
      delete w.__notesE2eInsertCsv
      delete w.__notesE2eSelectAttachment
      delete w.__notesE2eEditor
      delete w.__notesE2eGetMarkdown
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isModD(e)) return
      const term = selectedTextFromEditor(editor).trim()
      if (!term) return
      const handler = onAddDictionaryRef.current
      if (!handler?.(term)) return
      e.preventDefault()
      e.stopPropagation()
    }
    const dom = editor.view.dom
    dom.addEventListener('keydown', onKeyDown, true)
    return () => dom.removeEventListener('keydown', onKeyDown, true)
  }, [editor])

  useEffect(() => {
    if (!editor || !onLookupSelection) return
    const dom = editor.view.dom

    const onContextMenu = (event: MouseEvent) => {
      if (!onLookupSelectionRef.current || !onArchiveTodoLineRef.current || !onRestoreTodoLineRef.current) {
        return
      }
      const items = buildEditorContextMenuItems(
        editor,
        onLookupSelectionRef.current,
        onArchiveTodoLineRef.current,
        onRestoreTodoLineRef.current,
      )
      if (items.length === 0) return
      event.preventDefault()
      openEditorContextMenu(event.clientX, event.clientY)
    }

    const onTouchStart = (event: TouchEvent) => {
      const t = event.touches[0]
      if (!t) return
      touchPosRef.current = { x: t.clientX, y: t.clientY }
      if (longPressRef.current) clearTimeout(longPressRef.current)
      longPressRef.current = setTimeout(() => {
        if (!onLookupSelectionRef.current || !onArchiveTodoLineRef.current || !onRestoreTodoLineRef.current) {
          return
        }
        const items = buildEditorContextMenuItems(
          editor,
          onLookupSelectionRef.current,
          onArchiveTodoLineRef.current,
          onRestoreTodoLineRef.current,
        )
        if (items.length === 0) return
        openEditorContextMenu(touchPosRef.current.x, touchPosRef.current.y)
      }, 500)
    }

    const clearLongPress = () => {
      if (longPressRef.current) clearTimeout(longPressRef.current)
    }

    dom.addEventListener('contextmenu', onContextMenu)
    dom.addEventListener('touchstart', onTouchStart, { passive: true })
    dom.addEventListener('touchend', clearLongPress)
    dom.addEventListener('touchmove', clearLongPress)
    return () => {
      dom.removeEventListener('contextmenu', onContextMenu)
      dom.removeEventListener('touchstart', onTouchStart)
      dom.removeEventListener('touchend', clearLongPress)
      dom.removeEventListener('touchmove', clearLongPress)
      clearLongPress()
    }
  }, [editor, onLookupSelection, openEditorContextMenu])

  useEffect(() => {
    if (!editor) return
    refreshShorthandDecorations(editor)
  }, [activeTriggerQuery, editor])

  useEffect(() => {
    const debounce = debounceRef
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [])

  return (
    <div
      className="notes-tiptap-wrap flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--uv-bg-elevated)]"
      data-testid="notes-tiptap-editor"
    >
      <NotesEditorToolbar editor={editor} lineHeight={lineHeight} onLineHeightChange={handleLineHeightChange} />
      <NotesTableMenu editor={editor} />
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-auto overscroll-contain" />
      <NotesContextMenu
        state={ctxMenu ? { ...ctxMenu, testId: 'notes-editor-context-menu' } : null}
        onClose={() => setCtxMenu(null)}
      />
    </div>
  )
})

export default TiptapNoteEditor
