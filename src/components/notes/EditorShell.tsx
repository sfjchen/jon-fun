'use client'

import dynamic from 'next/dynamic'
import { forwardRef } from 'react'
import type { NoteEditorHandle } from './TiptapNoteEditor'
import type { TriggerType } from '@/lib/notes/types'

const TiptapEditor = dynamic(() => import('./TiptapNoteEditor'), { ssr: false })

type EditorShellProps = {
  value: string
  screenshots: Record<string, import('@/lib/notes/types').Screenshot>
  onChange: (val: string) => void
  onTrigger: (type: TriggerType, query: string, context: string) => void
  activeTriggerQuery: string | null
  onAttachmentAdd: (attachment: import('@/lib/notes/types').Screenshot) => void
  onAttachmentUpdate: (id: string, patch: Partial<import('@/lib/notes/types').Screenshot>) => void
}

const EditorShell = forwardRef<NoteEditorHandle, EditorShellProps>(function EditorShell(props, ref) {
  return <TiptapEditor ref={ref} {...props} />
})

export default EditorShell
export type { NoteEditorHandle }
