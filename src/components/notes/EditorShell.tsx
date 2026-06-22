'use client'

import dynamic from 'next/dynamic'
import { forwardRef } from 'react'
import type { NoteEditorHandle } from './NoteEditor'
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

const EditorShell = forwardRef<NoteEditorHandle, EditorShellProps>(function EditorShell(props, ref) {
  if (useWysiwyg) {
    return (
      <TiptapEditor
        value={props.value}
        onChange={props.onChange}
        onTrigger={props.onTrigger}
        onScreenshotPaste={props.onScreenshotPaste}
      />
    )
  }
  return <CodeMirrorEditor ref={ref} {...props} />
})

export default EditorShell
