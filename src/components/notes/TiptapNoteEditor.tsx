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
import { refreshShorthandDecorations } from '@/lib/notes/tiptap/shorthandDecorations'
import { scheduleTriggerCheck } from '@/lib/notes/tiptap/triggerPlugin'
import type { Screenshot, TriggerType } from '@/lib/notes/types'
import NotesBubbleMenu from './NotesBubbleMenu'

export type NoteEditorHandle = {
  scrollToLine: (lineIndex: number) => void
}

type TiptapNoteEditorProps = {
  value: string
  screenshots: Record<string, Screenshot>
  onChange: (val: string) => void
  onTrigger: (type: TriggerType, query: string, context: string) => void
  activeTriggerQuery: string | null
}

const TiptapNoteEditor = forwardRef<NoteEditorHandle, TiptapNoteEditorProps>(function TiptapNoteEditor(
  { value, screenshots, onChange, onTrigger, activeTriggerQuery },
  ref,
) {
  const lastFiredRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTriggerStable = useCallback(onTrigger, [onTrigger])
  const activeQueryRef = useRef(activeTriggerQuery)
  activeQueryRef.current = activeTriggerQuery
  const screenshotsRef = useRef(screenshots)
  screenshotsRef.current = screenshots

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
      onChange(mergeTodoLinesIntoMarkdown(plain, md))
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
    editor.view.dispatch(editor.state.tr)
  }, [editor, screenshots])

  useEffect(() => {
    if (!editor) return
    const norm = (s: string) => s.replace(/\r\n/g, '\n').trimEnd()
    const current = norm(postprocessTodoMarkdown(markdownFromEditor(editor)))
    const next = norm(value)
    if (current !== next) {
      editor.commands.setContent(preprocessTodoMarkdown(value), {
        contentType: 'markdown',
        emitUpdate: false,
      })
    }
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
      className="notes-tiptap-wrap h-full min-h-0 flex-1 overflow-auto bg-[var(--uv-bg-elevated)]"
      data-testid="notes-tiptap-editor"
    >
      <NotesBubbleMenu editor={editor} />
      <EditorContent editor={editor} className="h-full min-h-0 flex-1" />
    </div>
  )
})

export default TiptapNoteEditor
