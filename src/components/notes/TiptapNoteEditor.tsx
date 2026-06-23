'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import {
  imageFileFromClipboard,
  imageFilesFromDataTransfer,
} from '@/lib/notes/attachments'
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
import { insertNoteAttachmentsFromFiles } from '@/lib/notes/tiptap/pasteImages'
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
  onScreenshotPaste: (id: string, base64: string, mimeType: string) => void
  activeTriggerQuery: string | null
}

const TiptapNoteEditor = forwardRef<NoteEditorHandle, TiptapNoteEditorProps>(function TiptapNoteEditor(
  { value, screenshots, onChange, onTrigger, onScreenshotPaste, activeTriggerQuery },
  ref,
) {
  const lastFiredRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const onTriggerStable = useCallback(onTrigger, [onTrigger])
  const pasteHandlerRef = useRef(onScreenshotPaste)
  pasteHandlerRef.current = onScreenshotPaste
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

  const handleImageFiles = useCallback(async (files: File[], ed: Editor | null) => {
    if (!ed) return
    await insertNoteAttachmentsFromFiles(ed, files, (id, base64, mimeType) =>
      pasteHandlerRef.current(id, base64, mimeType),
    )
  }, [])

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
        const file = imageFileFromClipboard(event)
        if (!file || !editor) return false
        event.preventDefault()
        void handleImageFiles([file], editor)
        return true
      },
      handleDrop(_view, event) {
        const files = imageFilesFromDataTransfer(event.dataTransfer)
        if (!files.length || !editor) return false
        event.preventDefault()
        void handleImageFiles(files, editor)
        return true
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="notes-attach-file-input"
        onChange={(e) => {
          const files = e.target.files ? [...e.target.files] : []
          e.target.value = ''
          if (files.length && editor) void handleImageFiles(files, editor)
        }}
      />
      <div className="notes-editor-toolbar flex shrink-0 items-center gap-1 border-b border-[var(--uv-border)] px-2 py-1">
        <button
          type="button"
          title="Attach image"
          data-testid="notes-attach-file-btn"
          className="rounded px-2 py-0.5 text-[11px] text-[var(--uv-text-secondary)] hover:bg-[var(--uv-bg-hover)]"
          onClick={() => fileInputRef.current?.click()}
        >
          📷 Attach
        </button>
        <span className="text-[10px] text-[var(--uv-text-muted)]">Paste or drop screenshots</span>
      </div>
      <NotesBubbleMenu editor={editor} />
      <EditorContent editor={editor} className="h-full min-h-0 flex-1" />
    </div>
  )
})

export default TiptapNoteEditor
