import type { TriggerResult } from './types'

/** Term after ? — letters/digits/hyphen/dot (e.g. DPI, MOIC, LP-GP). */
const TERM = String.raw`[\w][\w.-]*`
const PHRASE = String.raw`\[[^\]]+\]`
const TERM_OR_PHRASE = String.raw`(?:${TERM}|${PHRASE})`

function extractQuery(raw: string): string {
  if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1)
  return raw
}

function buildWordResult(
  lineStart: number,
  textBeforeCursor: string,
  matchStr: string,
  rawQuery: string,
  lastFiredQuery: string | null,
): TriggerResult | null {
  const query = extractQuery(rawQuery)
  if (!query || query === lastFiredQuery) return null
  const matchStart = lineStart + textBeforeCursor.lastIndexOf(matchStr)
  return { type: 'word', query, matchStart, matchEnd: matchStart + matchStr.length }
}

/** Detect ?word / ?[phrase] + space/punctuation, or previous line ?term on Enter. */
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

      const delimRe = new RegExp(String.raw`(?:^|\s)\?(${TERM_OR_PHRASE})([\s.,;:!?)]+)$`)
      const delimMatch = textBeforeCursor.match(delimRe)
      if (delimMatch?.[1] && delimMatch[2]) {
        const raw = delimMatch[1]
        const matchStr = raw.startsWith('[') ? `?[${extractQuery(raw)}]` : `?${raw}`
        const hit = buildWordResult(lineStart, textBeforeCursor, matchStr, raw, lastFiredQuery)
        if (hit) return hit
      }

      if (i > 0 && cursorInLine === 0) {
        const prevLine = lines[i - 1]!

        const enterTermRe = new RegExp(String.raw`(?:^|\s)\?(${TERM_OR_PHRASE})\s*$`)
        const enterMatch = prevLine.match(enterTermRe)
        if (enterMatch?.[1]) {
          const raw = enterMatch[1]
          const matchStr = raw.startsWith('[') ? `?[${extractQuery(raw)}]` : `?${raw}`
          const prevStart = lineStart - prevLine.length - 1
          const hit = buildWordResult(prevStart, prevLine, matchStr, raw, lastFiredQuery)
          if (hit) return hit
        }

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
    if (/(?:^|\s)\?(\w[\w.-]*|\[[^\]]+\])/.test(line)) flags++
    if (/^\s*>/.test(line)) actions++
  }
  return { flags, actions, chars: text.length }
}
