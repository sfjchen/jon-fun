'use client'

import type { Editor } from '@tiptap/core'
import type { TriggerType } from '@/lib/notes/types'
import {
  lineIndexAtCursor,
  plainTextFromEditor,
  selectedTextFromEditor,
} from '@/lib/notes/tiptap/editorCoords'
import { isArchivedTodoLine, parseActiveTodoLine } from '@/lib/notes/todoLines'
import type { NotesMenuItem } from './NotesActionUi'

export function buildEditorContextMenuItems(
  editor: Editor,
  onLookupSelection: (query: string, type: TriggerType) => void,
  onArchiveTodoLine: (lineIndex: number) => void,
  onRestoreTodoLine: (lineIndex: number) => void,
): NotesMenuItem[] {
  const items: NotesMenuItem[] = []
  const selected = selectedTextFromEditor(editor).trim()

  if (selected.length > 0) {
    items.push({
      id: 'lookup-line',
      label: 'AI lookup (?)',
      onClick: () => onLookupSelection(selected, 'line'),
    })
    items.push({
      id: 'lookup-section',
      label: 'AI section (??)',
      onClick: () => onLookupSelection(selected, 'section'),
    })
  }

  const plain = plainTextFromEditor(editor)
  const lineIdx = lineIndexAtCursor(editor)
  const line = plain.split('\n')[lineIdx] ?? ''

  if (parseActiveTodoLine(line)) {
    items.push({
      id: 'archive-todo',
      label: 'Mark todo complete',
      onClick: () => onArchiveTodoLine(lineIdx),
    })
  } else if (isArchivedTodoLine(line)) {
    items.push({
      id: 'restore-todo',
      label: 'Restore todo',
      onClick: () => onRestoreTodoLine(lineIdx),
    })
  }

  return items
}
