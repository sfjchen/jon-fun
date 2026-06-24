'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { buildNotesExtensions, NOTES_EDITOR_PLACEHOLDER } from '@/lib/notes/tiptap/extensions'
import type { NoteAttachmentStorage } from '@/lib/notes/tiptap/noteAttachment'
import {
  markdownFromEditor,
  mergeTodoLinesIntoMarkdown,
  plainTextFromEditor,
  postprocessTodoMarkdown,
  preprocessTodoMarkdown,
  scrollToLineIndex,
} from '@/lib/notes/tiptap/editorCoords'
import { normalizeNotesMarkdown } from '@/lib/notes/tiptap/markdownNormalize'
import { refreshShorthandDecorations } from '@/lib/notes/tiptap/shorthandDecorations'
import { scheduleTriggerCheck } from '@/lib/notes/tiptap/triggerPlugin'
import type { Screenshot, TriggerType } from '@/lib/notes/types'
import NotesBubbleMenu from './NotesBubbleMenu'
import NotesEditorToolbar from './NotesEditorToolbar'

export type NoteEditorHandle = {
  scrollToLine: (lineIndex: number) => void
}

type TiptapNoteEditorProps = {
  value: string
  screenshots: Record<string, Screenshot>
  onChange: (val: string) => void
  onTrigger: (type: TriggerType, query: string, context: string) => void
  activeTriggerQuery: string | null
  onAttachmentAdd: (attachment: Screenshot) => void
  onAttachmentUpdate: (id: string, patch: Partial<Screenshot>) => void
}

function editorMarkdown(ed: import('@tiptap/core').Editor): string {
  return normalizeNotesMarkdown(postprocessTodoMarkdown(markdownFromEditor(ed)))
}

const TiptapNoteEditor = forwardRef<NoteEditorHandle, TiptapNoteEditorProps>(function TiptapNoteEditor(
  { value, screenshots, onChange, onTrigger, activeTriggerQuery, onAttachmentAdd, onAttachmentUpdate },
  ref,
) {
  const lastFiredRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emittedMarkdownRef = useRef<string | null>(null)
  const onTriggerStable = useCallback(onTrigger, [onTrigger])
  const activeQueryRef = useRef(activeTriggerQuery)
  activeQueryRef.current = activeTriggerQuery
  const screenshotsRef = useRef(screenshots)
  screenshotsRef.current = screenshots

  const onAttachmentAddRef = useRef(onAttachmentAdd)
  const onAttachmentUpdateRef = useRef(onAttachmentUpdate)
  onAttachmentAddRef.current = onAttachmentAdd
  onAttachmentUpdateRef.current = onAttachmentUpdate

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
        class: 'tiptap notes-tiptap min-h-full px-4 py-3 text-base leading-relaxed focus:outline-none',
      },
    },
  })

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

  useEffect(() => {
    if (!editor) return
    const next = normalizeNotesMarkdown(value)
    if (emittedMarkdownRef.current !== null && emittedMarkdownRef.current === next) return

    const current = editorMarkdown(editor)
    if (current === next) {
      emittedMarkdownRef.current = next
      return
    }

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
      <NotesEditorToolbar editor={editor} />
      <NotesBubbleMenu editor={editor} />
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-auto" />
    </div>
  )
})

export default TiptapNoteEditor
