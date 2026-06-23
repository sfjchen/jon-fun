'use client'

import dynamic from 'next/dynamic'
import { forwardRef, type Ref } from 'react'
import type { NoteEditorHandle as CmHandle } from './NoteEditor'
import type { NoteEditorHandle as TiptapHandle } from './TiptapNoteEditor'
import type { TriggerType } from '@/lib/notes/types'

const CodeMirrorEditor = dynamic(() => import('./NoteEditor'), { ssr: false })
const TiptapEditor = dynamic(() => import('./TiptapNoteEditor'), { ssr: false })

const useWysiwyg = process.env.NEXT_PUBLIC_NOTES_WYSIWYG === '1'

type EditorShellProps = {
  value: string
  onChange: (val: string) => void
  onTrigger: (type: TriggerType, query: string, context: string) => void
  onScreenshotPaste: (id: string, base64: string, mimeType: string) => void
  activeTriggerQuery: string | null
}

export type NoteEditorHandle = CmHandle | TiptapHandle

const EditorShell = forwardRef<NoteEditorHandle, EditorShellProps>(function EditorShell(props, ref) {
  if (useWysiwyg) {
    return <TiptapEditor ref={ref as Ref<TiptapHandle>} {...props} />
  }
  return <CodeMirrorEditor ref={ref as Ref<CmHandle>} {...props} />
})

export default EditorShell
