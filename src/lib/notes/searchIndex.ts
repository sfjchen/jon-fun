import { loadGlossary } from './glossary'
import type { NoteSession, SearchHit } from './types'

function scoreMatch(text: string, q: string): number {
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  if (!needle) return 0
  if (lower === needle) return 100
  if (lower.startsWith(needle)) return 80
  if (lower.includes(needle)) return 50
  return 0
}

function snippetAround(text: string, q: string, radius = 60): string {
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return text.slice(0, radius * 2)
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + q.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

export function searchNotes(
  sessions: NoteSession[],
  query: string,
  facet: 'all' | 'body' | 'todo' | 'term' | 'chat' = 'all',
): SearchHit[] {
  const q = query.trim()
  if (!q) return []
  const hits: SearchHit[] = []

  for (const s of sessions) {
    if (facet === 'all' || facet === 'body') {
      const sc = scoreMatch(s.notes, q)
      if (sc > 0) {
        hits.push({
          sessionId: s.id,
          sessionTitle: s.title,
          facet: 'body',
          snippet: snippetAround(s.notes, q),
          score: sc,
        })
      }
      const scTitle = scoreMatch(s.title, q)
      if (scTitle > 0) {
        hits.push({
          sessionId: s.id,
          sessionTitle: s.title,
          facet: 'body',
          snippet: s.title,
          score: scTitle + 10,
        })
      }
    }

    if (facet === 'all' || facet === 'todo') {
      s.notes.split('\n').forEach((line, lineIndex) => {
        if (!/^\s*>/.test(line)) return
        const sc = scoreMatch(line, q)
        if (sc > 0) {
          hits.push({
            sessionId: s.id,
            sessionTitle: s.title,
            facet: 'todo',
            snippet: line.trim(),
            lineIndex,
            score: sc + 5,
          })
        }
      })
    }

    if (facet === 'all' || facet === 'chat') {
      for (const lk of s.lookups) {
        const ans = lk.conversation.find((m) => m.role === 'assistant')?.content ?? ''
        const combined = `${lk.query} ${ans}`
        const sc = scoreMatch(combined, q)
        if (sc > 0) {
          hits.push({
            sessionId: s.id,
            sessionTitle: s.title,
            facet: 'chat',
            snippet: snippetAround(combined, q),
            score: sc,
          })
        }
      }
    }
  }

  if (facet === 'all' || facet === 'term') {
    for (const e of loadGlossary()) {
      const sc = Math.max(scoreMatch(e.term, q), scoreMatch(e.definition, q) * 0.8)
      if (sc > 0) {
        hits.push({
          sessionId: e.sourceNoteId,
          sessionTitle: e.term,
          facet: 'term',
          snippet: e.definition.slice(0, 120),
          score: sc + 8,
        })
      }
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 40)
}
