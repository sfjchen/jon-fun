/** Shared shorthand parsing: todos, highlights, AI triggers, counts. */

import {
  collectActiveTodosFromNotes,
  parseActiveTodoLine,
  isArchivedTodoLine,
} from './todoLines'

export type TodoLine = { text: string; lineIndex: number }

export {
  collectActiveTodosFromNotes,
  collectArchivedTodosFromNotes,
  setTodoArchivedAtLine,
} from './todoLines'

const HIGHLIGHT = /\*([^*\n]+)\*/g

/** Todo: suffix `>` or legacy prefix `>` (excludes archived `✓>`). */
export function parseTodoLine(line: string): string | null {
  return parseActiveTodoLine(line)
}

export function collectTodosFromNotes(notes: string): TodoLine[] {
  return collectActiveTodosFromNotes(notes)
}

export function countShorthandFlags(text: string): { flags: number; actions: number; chars: number } {
  const lines = text.split('\n')
  let flags = 0
  let actions = 0
  for (const line of lines) {
    if (/\?\?|\?(?:\s|$)/.test(line)) flags++
    if (parseTodoLine(line)) actions++
  }
  return { flags, actions, chars: text.length }
}

/** Ranges of *highlight* spans in plain text (for decorations). */
export function highlightRanges(text: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(HIGHLIGHT.source, 'g')
  while ((m = re.exec(text)) !== null) {
    ranges.push({ from: m.index, to: m.index + m[0].length })
  }
  return ranges
}

export function isTodoLine(line: string): boolean {
  return parseActiveTodoLine(line) !== null || isArchivedTodoLine(line)
}
