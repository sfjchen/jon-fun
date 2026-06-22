'use client'

import dynamic from 'next/dynamic'
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { decorationPlugin, editorPlaceholder, triggerPlugin, uvimcoEditorTheme } from '@/lib/notes/cmDecorations'
import type { TriggerType } from '@/lib/notes/types'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then((m) => m.default), { ssr: false })

export type NoteEditorHandle = {
  scrollToLine: (lineIndex: number) => void
}

type NoteEditorProps = {
  value: string
  onChange: (val: string) => void
  onTrigger: (type: TriggerType, query: string, context: string) => void
  onScreenshotPaste: (id: string, base64: string, mimeType: string) => void
  activeTriggerQuery: string | null
}

function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  })
  return true
}

function prefixLine(view: EditorView, prefix: string) {
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const text = line.text
  const trimmed = text.trimStart()
  const indent = text.slice(0, text.length - trimmed.length)
  if (trimmed.startsWith(prefix)) return true
  view.dispatch({
    changes: { from: line.from, to: line.from + indent.length, insert: indent + prefix },
  })
  return true
}

const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  { value, onChange, onTrigger, onScreenshotPaste, activeTriggerQuery },
  ref,
) {
  const lastFiredRef = useRef<string | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onTriggerStable = useCallback(onTrigger, [onTrigger])
  const pasteHandlerRef = useRef(onScreenshotPaste)
  pasteHandlerRef.current = onScreenshotPaste

  useImperativeHandle(ref, () => ({
    scrollToLine(lineIndex: number) {
      const view = viewRef.current
      if (!view) return
      const line = Math.min(lineIndex + 1, view.state.doc.lines)
      const ln = view.state.doc.line(line)
      view.dispatch({
        effects: EditorView.scrollIntoView(ln.from, { y: 'center' }),
        selection: { anchor: ln.from },
      })
      view.focus()
    },
  }))

  const extensions = useMemo((): Extension[] => {
    const docsKeymap = keymap.of([
      { key: 'Mod-b', run: (view) => wrapSelection(view, '**', '**') },
      { key: 'Mod-i', run: (view) => wrapSelection(view, '*', '*') },
      { key: 'Mod-u', run: (view) => wrapSelection(view, '__', '__') },
      { key: 'Mod-Shift-7', run: (view) => prefixLine(view, '1. ') },
      { key: 'Mod-Shift-8', run: (view) => prefixLine(view, '- ') },
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ])

    return [
      EditorView.lineWrapping,
      history(),
      markdown({ base: markdownLanguage }),
      uvimcoEditorTheme,
      editorPlaceholder,
      decorationPlugin(activeTriggerQuery),
      triggerPlugin(onTriggerStable, lastFiredRef),
      docsKeymap,
      EditorView.domEventHandlers({
        paste(event, view) {
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
              const pos = view.state.selection.main.head
              view.dispatch({ changes: { from: pos, insert: `[📷 ${id}]\n` } })
            }
            reader.readAsDataURL(file)
            return true
          }
          return false
        },
      }),
      EditorView.updateListener.of((u) => {
        if (u.view) viewRef.current = u.view
      }),
    ]
  }, [activeTriggerQuery, onTriggerStable])

  return (
    <CodeMirror
      value={value}
      height="100%"
      className="uvimco-cm h-full min-h-0 flex-1"
      extensions={extensions}
      onChange={(v) => {
        onChange(v)
        const last = lastFiredRef.current
        if (last && !v.includes('?')) lastFiredRef.current = null
      }}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
    />
  )
})

export default NoteEditor
