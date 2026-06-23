import { DEBOUNCE_MS, detectLineTriggers } from '../triggerParser'
import type { TriggerType } from '../types'
import { plainTextCursorOffset, plainTextFromEditor } from './editorCoords'

/** Debounced trigger check from editor onUpdate. */
export function scheduleTriggerCheck(
  editor: import('@tiptap/core').Editor,
  debounceRef: { current: ReturnType<typeof setTimeout> | null },
  onTrigger: (type: TriggerType, query: string, context: string) => void,
  lastFiredRef: { current: string | null },
): void {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => {
    debounceRef.current = null
    const plain = plainTextFromEditor(editor)
    const pos = plainTextCursorOffset(editor)
    const result = detectLineTriggers(plain, pos, lastFiredRef.current)
    if (!result) return
    lastFiredRef.current = result.fireKey
    onTrigger(result.type, result.query, result.context)
  }, DEBOUNCE_MS)
}
