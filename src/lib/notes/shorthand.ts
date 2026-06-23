/** Shared shorthand parsing: todos, highlights, AI triggers, counts. */

export type TodoLine = { text: string; lineIndex: number }

const TODO_SUFFIX = /^(.+?)\s*[<>]\s*$/
const TODO_PREFIX = /^\s*>\s?(.*)$/
const HIGHLIGHT = /\*([^*\n]+)\*/g

/** Todo: suffix `>`/`<` on a line, or legacy prefix `>`. */
export function parseTodoLine(line: string): string | null {
  const trimmed = line.trim()
  const suffix = trimmed.match(TODO_SUFFIX)
  if (suffix?.[1]?.trim()) return suffix[1].trim()
  const prefix = trimmed.match(TODO_PREFIX)
  if (prefix?.[1]?.trim()) return prefix[1].trim()
  return null
}

export function collectTodosFromNotes(notes: string): TodoLine[] {
  const out: TodoLine[] = []
  notes.split('\n').forEach((line, lineIndex) => {
    const text = parseTodoLine(line)
    if (text) out.push({ text, lineIndex })
  })
  return out
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
  return parseTodoLine(line) !== null
}
