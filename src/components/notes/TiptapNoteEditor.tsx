'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { buildNotesExtensions, NOTES_EDITOR_PLACEHOLDER } from '@/lib/notes/tiptap/extensions'
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
import type { TriggerType } from '@/lib/notes/types'
import NotesBubbleMenu from './NotesBubbleMenu'

export type NoteEditorHandle = {
  scrollToLine: (lineIndex: number) => void
}

type TiptapNoteEditorProps = {
  value: string
  onChange: (val: string) => void
  onTrigger: (type: TriggerType, query: string, context: string) => void
  onScreenshotPaste: (id: string, base64: string, mimeType: string) => void
  activeTriggerQuery: string | null
}

const TiptapNoteEditor = forwardRef<NoteEditorHandle, TiptapNoteEditorProps>(function TiptapNoteEditor(
  { value, onChange, onTrigger, onScreenshotPaste, activeTriggerQuery },
  ref,
) {
  const lastFiredRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTriggerStable = useCallback(onTrigger, [onTrigger])
  const pasteHandlerRef = useRef(onScreenshotPaste)
  pasteHandlerRef.current = onScreenshotPaste
  const activeQueryRef = useRef(activeTriggerQuery)
  activeQueryRef.current = activeTriggerQuery

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
      handlePaste(_view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (!item.type.startsWith('image/')) continue
          event.preventDefault()
          const file = item.getAsFile()
          if (!file) return true
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            const base64 = dataUrl.split(',')[1] ?? ''
            const id = `screenshot-${Date.now()}`
            pasteHandlerRef.current(id, base64, file.type)
            editor?.chain().focus().insertContent(`[📷 ${id}]\n`).run()
          }
          reader.readAsDataURL(file)
          return true
        }
        return false
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div
      className="notes-tiptap-wrap h-full min-h-0 flex-1 overflow-auto bg-[var(--uv-bg-elevated)]"
      data-testid="notes-tiptap-editor"
    >
      <NotesBubbleMenu editor={editor} />
      <EditorContent editor={editor} className="h-full" />
    </div>
  )
})

export default TiptapNoteEditor
