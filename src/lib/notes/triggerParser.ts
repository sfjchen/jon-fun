import type { TriggerResult } from './types'
import { countShorthandFlags } from './shorthand'

export { countShorthandFlags }

const DEBOUNCE_MS = 400

/** Extract section context: from previous blank line (or doc start) through current line. */
export function extractSectionContext(fullText: string, lineIndex: number): string {
  const lines = fullText.split('\n')
  let start = lineIndex
  while (start > 0 && lines[start - 1]!.trim() !== '') start--
  return lines.slice(start, lineIndex + 1).join('\n')
}

/** Line ending with ? or ?? at cursor; fires after debounce on ? keystroke. */
export function detectLineTriggers(
  fullText: string,
  cursorPos: number,
  lastFiredKey: string | null,
): TriggerResult | null {
  const lines = fullText.split('\n')
  let charCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineStart = charCount
    const lineEnd = charCount + line.length

    if (cursorPos < lineStart || cursorPos > lineEnd) {
      charCount += line.length + 1
      continue
    }

    const cursorInLine = cursorPos - lineStart
    const textBeforeCursor = line.slice(0, cursorInLine)
    const trimmedEnd = textBeforeCursor.trimEnd()

    if (trimmedEnd.endsWith('??') && trimmedEnd.length > 2) {
      const query = trimmedEnd.slice(0, -2).trim()
      const fireKey = `section:${query}:${i}`
      if (query && fireKey !== lastFiredKey) {
        return {
          type: 'section',
          query,
          context: extractSectionContext(fullText, i),
          matchStart: lineStart,
          matchEnd: lineStart + cursorInLine,
          fireKey,
        }
      }
    } else if (trimmedEnd.endsWith('?') && !trimmedEnd.endsWith('??') && trimmedEnd.length > 1) {
      const query = trimmedEnd.slice(0, -1).trim()
      const linesBefore = lines.slice(Math.max(0, i - 15), i + 1)
      const fireKey = `line:${query}:${i}`
      if (query && fireKey !== lastFiredKey) {
        return {
          type: 'line',
          query,
          context: linesBefore.join('\n'),
          matchStart: lineStart,
          matchEnd: lineStart + cursorInLine,
          fireKey,
        }
      }
    }

    charCount += line.length + 1
  }

  return null
}

export function getContext(fullText: string, cursorPos: number, lineCount = 15): string {
  const allLines = fullText.slice(0, cursorPos).split('\n')
  return allLines.slice(-lineCount).join('\n')
}

export { DEBOUNCE_MS }
