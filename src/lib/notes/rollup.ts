import type { NoteSession, TodoRollupItem } from './types'

export function collectTodos(sessions: NoteSession[]): TodoRollupItem[] {
  const out: TodoRollupItem[] = []
  for (const s of sessions) {
    const meetingAt = s.metadata?.meetingAt ?? s.startedAt
    s.notes.split('\n').forEach((line, lineIndex) => {
      const m = line.match(/^\s*>\s?(.*)$/)
      if (m?.[1]?.trim()) {
        out.push({
          sessionId: s.id,
          sessionTitle: s.title,
          meetingAt,
          text: m[1].trim(),
          lineIndex,
        })
      }
    })
  }
  return out.sort((a, b) => b.meetingAt.localeCompare(a.meetingAt))
}

export function formatTodoRollupMarkdown(items: TodoRollupItem[]): string {
  if (!items.length) return 'No action items across notes.'
  const byNote = new Map<string, TodoRollupItem[]>()
  for (const it of items) {
    const list = byNote.get(it.sessionId) ?? []
    list.push(it)
    byNote.set(it.sessionId, list)
  }
  const lines: string[] = ['Action items across all notes', '']
  for (const [, group] of byNote) {
    const g = group[0]!
    lines.push(`${g.sessionTitle} (${new Date(g.meetingAt).toLocaleDateString()})`)
    for (const it of group) lines.push(`- ${it.text}`)
    lines.push('')
  }
  return lines.join('\n')
}
