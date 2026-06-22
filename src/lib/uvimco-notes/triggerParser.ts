import type { TriggerResult } from './types'

/** Detect ?word / ?[phrase] + space, or previous line ending with ? after Enter. */
export function detectTriggers(
  fullText: string,
  cursorPos: number,
  lastFiredQuery: string | null,
): TriggerResult | null {
  const lines = fullText.split('\n')
  let charCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineStart = charCount
    const lineEnd = charCount + line.length

    if (cursorPos >= lineStart && cursorPos <= lineEnd + 1) {
      const cursorInLine = cursorPos - lineStart
      const textBeforeCursor = line.slice(0, cursorInLine)

      const phraseMatch = textBeforeCursor.match(/(?:^|\s)\?\[([^\]]+)\]\s$/)
      const wordMatch = textBeforeCursor.match(/(?:^|\s)\?(\w+)\s$/)
      const match = phraseMatch ?? wordMatch

      if (match?.[1] && match[1] !== lastFiredQuery) {
        const query = match[1]
        const matchStr = phraseMatch ? `?[${query}]` : `?${query}`
        const matchStart = lineStart + textBeforeCursor.lastIndexOf(matchStr)
        return { type: 'word', query, matchStart, matchEnd: matchStart + matchStr.length }
      }

      if (i > 0 && cursorInLine === 0) {
        const prevLine = lines[i - 1]!
        const trimmed = prevLine.trim()
        if (trimmed.endsWith('?') && trimmed.length > 1) {
          const query = trimmed.slice(0, -1).trim()
          if (query && query !== lastFiredQuery) {
            const prevStart = lineStart - prevLine.length - 1
            return { type: 'line', query, matchStart: prevStart, matchEnd: lineStart - 1 }
          }
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

export function countShorthandFlags(text: string): { flags: number; actions: number; chars: number } {
  const lines = text.split('\n')
  let flags = 0
  let actions = 0
  for (const line of lines) {
    if (/(?:^|\s)\?(\w+|\[[^\]]+\])/.test(line)) flags++
    if (/^\s*>/.test(line)) actions++
  }
  return { flags, actions, chars: text.length }
}
