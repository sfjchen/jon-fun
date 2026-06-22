/**
 * Auto-section notes by blank-line blocks; label blocks for AI context.
 */

export type SectionKind = 'body' | 'actions' | 'highlights' | 'questions'

export interface NoteSection {
  index: number
  kind: SectionKind
  lines: string[]
  preview: string
  todoCount: number
  questionMarks: number
}

function classifySection(lines: string[]): SectionKind {
  const todos = lines.filter((l) => /^\s*>/.test(l)).length
  const highlights = lines.filter((l) => /^\s*\*/.test(l)).length
  const questions = lines.filter((l) => /\?\?|\?(?:\s|$)/.test(l)).length
  if (todos >= lines.length / 2 && todos > 0) return 'actions'
  if (highlights >= lines.length / 2 && highlights > 0) return 'highlights'
  if (questions > 0) return 'questions'
  return 'body'
}

/** Split note body into blank-line sections with lightweight classification. */
export function parseNoteSections(notes: string): NoteSection[] {
  if (!notes.trim()) return []

  const blocks: string[][] = []
  let current: string[] = []

  for (const line of notes.split('\n')) {
    if (line.trim() === '' && current.length) {
      blocks.push(current)
      current = []
    } else {
      current.push(line)
    }
  }
  if (current.length) blocks.push(current)

  return blocks.map((lines, index) => {
    const kind = classifySection(lines)
    const preview = lines
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' · ')
      .slice(0, 120)
    return {
      index,
      kind,
      lines,
      preview: preview || '(empty)',
      todoCount: lines.filter((l) => /^\s*>/.test(l)).length,
      questionMarks: lines.filter((l) => /\?\?|\?(?:\s|$)/.test(l)).length,
    }
  })
}

/** Find section containing a line index (0-based). */
export function sectionAtLine(sections: NoteSection[], lineIndex: number): NoteSection | null {
  let cursor = 0
  for (const sec of sections) {
    const end = cursor + sec.lines.length
    if (lineIndex >= cursor && lineIndex < end) return sec
    cursor = end + 1 // blank line between blocks
  }
  return sections[sections.length - 1] ?? null
}

/** Dense outline for LLM — section index, kind, preview. */
export function formatSectionsOutline(sections: NoteSection[], maxSections = 8): string {
  if (!sections.length) return '(single block or empty)'
  return sections
    .slice(0, maxSections)
    .map((s) => `[§${s.index + 1} ${s.kind}] ${s.preview}${s.todoCount ? ` (${s.todoCount} todos)` : ''}`)
    .join('\n')
}

/** Suggest tags from section content + domains (caller merges with registry). */
export function suggestTagsFromSections(sections: NoteSection[]): string[] {
  const tags = new Set<string>()
  const text = sections.map((s) => s.lines.join('\n')).join('\n').toLowerCase()
  if (/\b(ic|investment committee)\b/.test(text)) tags.add('IC')
  if (/\b(gp|general partner)\b/.test(text)) tags.add('GP')
  if (/\b(cfa|ifrs|gaap)\b/.test(text)) tags.add('CFA')
  if (/\b(ir|information ratio|active share|grinold)\b/.test(text)) tags.add('APM')
  if (/\b(endowment|ltp|uvimco)\b/.test(text)) tags.add('endowment')
  return [...tags]
}
