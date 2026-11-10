import type { NoteSession, TodoRollupItem } from './types'
import { collectTodosFromNotes } from './shorthand'

export function collectTodos(sessions: NoteSession[]): TodoRollupItem[] {
  const out: TodoRollupItem[] = []
  for (const s of sessions) {
    const meetingAt = s.startedAt
    for (const { text, lineIndex } of collectTodosFromNotes(s.notes)) {
      out.push({
        sessionId: s.id,
        sessionTitle: s.title,
        meetingAt,
        text,
        lineIndex,
      })
    }
  }
  return out.sort((a, b) => b.meetingAt.localeCompare(a.meetingAt))
}
