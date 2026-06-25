/** Todo line helpers: active (`text >`), archived/done (`text ✓>`). */

import type { TodoLine } from './shorthand'

const ACTIVE_SUFFIX = /^(.+?)\s*>\s*$/
const ARCHIVED_SUFFIX = /^(.+?)\s*✓\s*>\s*$/
const ACTIVE_PREFIX = /^\s*>\s?(.*)$/
const ARCHIVED_PREFIX = /^\s*>\s*✓\s?(.*)$/

export function isArchivedTodoLine(line: string): boolean {
  const t = line.trim()
  return ARCHIVED_SUFFIX.test(t) || ARCHIVED_PREFIX.test(t)
}

/** Active todo only (not archived). */
export function parseActiveTodoLine(line: string): string | null {
  if (isArchivedTodoLine(line)) return null
  const trimmed = line.trim()
  const suffix = trimmed.match(ACTIVE_SUFFIX)
  if (suffix?.[1]?.trim()) return suffix[1].trim()
  const prefix = trimmed.match(ACTIVE_PREFIX)
  if (prefix?.[1]?.trim() && !prefix[1].trim().startsWith('✓')) return prefix[1].trim()
  return null
}

export function parseArchivedTodoLine(line: string): string | null {
  const trimmed = line.trim()
  const suffix = trimmed.match(ARCHIVED_SUFFIX)
  if (suffix?.[1]?.trim()) return suffix[1].trim()
  const prefix = trimmed.match(ARCHIVED_PREFIX)
  if (prefix?.[1]?.trim()) return prefix[1].trim()
  return null
}

export function collectActiveTodosFromNotes(notes: string): TodoLine[] {
  const out: TodoLine[] = []
  notes.split('\n').forEach((line, lineIndex) => {
    const text = parseActiveTodoLine(line)
    if (text) out.push({ text, lineIndex })
  })
  return out
}

export function collectArchivedTodosFromNotes(notes: string): TodoLine[] {
  const out: TodoLine[] = []
  notes.split('\n').forEach((line, lineIndex) => {
    const text = parseArchivedTodoLine(line)
    if (text) out.push({ text, lineIndex })
  })
  return out
}

/** Mark line at index done (`text ✓>`) or restore active (`text >`). */
export function setTodoArchivedAtLine(notes: string, lineIndex: number, archived: boolean): string {
  const lines = notes.split('\n')
  const line = lines[lineIndex]
  if (line === undefined) return notes

  const active = parseActiveTodoLine(line)
  const done = parseArchivedTodoLine(line)
  if (archived && active) {
    lines[lineIndex] = `${active} ✓>`
  } else if (!archived && done) {
    lines[lineIndex] = `${done} >`
  }
  return lines.join('\n')
}
