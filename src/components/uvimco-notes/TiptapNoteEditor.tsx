'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect, useRef } from 'react'
import { DEBOUNCE_MS, detectLineTriggers } from '@/lib/uvimco-notes/triggerParser'
import type { TriggerType } from '@/lib/uvimco-notes/types'

type TiptapNoteEditorProps = {
  value: string
  onChange: (val: string) => void
  onTrigger: (type: TriggerType, query: string, context: string) => void
  onScreenshotPaste: (id: string, base64: string, mimeType: string) => void
}

/** Plain text from Tiptap doc for trigger detection + storage. */
function docToPlainText(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return ''
  return editor.getText({ blockSeparator: '\n' })
}

export default function TiptapNoteEditor({ value, onChange, onTrigger, onScreenshotPaste }: TiptapNoteEditorProps) {
  const lastFiredRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTriggerStable = useCallback(onTrigger, [onTrigger])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start typing. End a line with ? or ?? for AI · > todo · * highlight',
      }),
    ],
    content: value ? `<p>${value.split('\n').join('</p><p>')}</p>` : '',
    onUpdate: ({ editor: ed }) => {
      const plain = docToPlainText(ed)
      onChange(plain)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const pos = ed.state.selection.anchor
        const result = detectLineTriggers(plain, pos, lastFiredRef.current)
        if (result) {
          lastFiredRef.current = result.fireKey
          onTriggerStable(result.type, result.query, result.context)
        }
      }, DEBOUNCE_MS)
    },
    editorProps: {
      attributes: {
        class: 'uvimco-tiptap min-h-full px-4 py-3 text-base leading-relaxed focus:outline-none',
      },
      handlePaste(view, event) {
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
            onScreenshotPaste(id, base64, file.type)
            view.dispatch(view.state.tr.insertText(`[📷 ${id}]\n`))
          }
          reader.readAsDataURL(file)
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const plain = docToPlainText(editor)
    if (plain !== value) {
      editor.commands.setContent(value ? `<p>${value.split('\n').join('</p><p>')}</p>` : '', {
        emitUpdate: false,
      })
    }
  }, [value, editor])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="uvimco-tiptap-wrap h-full min-h-0 flex-1 overflow-auto bg-[var(--uv-bg-elevated)]" data-testid="notes-tiptap-editor">
      <EditorContent editor={editor} className="h-full" />
    </div>
  )
}
