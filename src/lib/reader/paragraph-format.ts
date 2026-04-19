/**
 * Normalize paragraph list after import so reading UI gets breathable blocks
 * (embedded newlines, very long PDF blobs split at sentence-ish boundaries).
 *
 * We only normalize **horizontal** whitespace and paragraph breaks — no wording changes,
 * no abbrev expansion, no summarization. Blank lines inside a block (verse / `<br>` chains)
 * are preserved.
 */

const ABBREV_NO_BREAK = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|Mt|vs|etc|i\.e|e\.g|Fig|Vol|Ch)\.)\s*$/i

/** Collapse spaces/tabs per line; keep empty lines; trim only leading/trailing empty lines of the block. */
export function normalizeLinesKeepVerticalStructure(raw: string): string {
  const lines = raw.split('\n').map((line) => line.replace(/[ \t\f\v]+/g, ' ').trimEnd())
  let a = 0
  while (a < lines.length && lines[a] === '') a++
  let b = lines.length
  while (b > a && lines[b - 1] === '') b--
  return lines.slice(a, b).join('\n')
}

function splitLongParagraphSingleLine(text: string, maxLen: number): string[] {
  const normalized = text.replace(/[ \t]+/g, ' ').trim()
  if (!normalized) return []
  if (normalized.length <= maxLen) return [normalized]

  const out: string[] = []
  let rest = normalized
  while (rest.length > maxLen) {
    const window = rest.slice(0, maxLen)
    let pieceEnd = -1
    let consumeFrom = 0

    for (let i = window.length - 1; i > 120; i--) {
      const c = rest[i]
      if ((c === '.' || c === '?' || c === '!') && rest[i + 1] === ' ') {
        const before = rest.slice(0, i + 1)
        if (!ABBREV_NO_BREAK.test(before)) {
          pieceEnd = i + 1
          consumeFrom = i + 2
          break
        }
      }
    }

    if (pieceEnd < 0) {
      const sp = window.lastIndexOf(' ')
      if (sp > maxLen * 0.45) {
        pieceEnd = sp
        consumeFrom = sp + 1
      } else {
        pieceEnd = maxLen
        consumeFrom = maxLen
      }
    }

    const piece = rest.slice(0, pieceEnd).trim()
    if (piece) out.push(piece)
    rest = rest.slice(consumeFrom).trim()
  }
  if (rest) out.push(rest)
  return out.filter(Boolean)
}

/** Long blobs split at sentence/word boundaries only — never drops characters. */
function splitLongParagraph(text: string, maxLen = 540): string[] {
  if (text === '') return ['']
  if (text.includes('\n')) {
    const lines = text.split('\n')
    const out: string[] = []
    for (const line of lines) {
      if (line === '') {
        out.push('')
        continue
      }
      out.push(...splitLongParagraphSingleLine(line, maxLen))
    }
    return out
  }
  return splitLongParagraphSingleLine(text, maxLen)
}

/** Split on blank lines from source text / EPUB / paste. */
export function expandEmbeddedNewlines(paragraphs: string[]): string[] {
  const out: string[] = []
  for (const p of paragraphs) {
    const blocks = p.split(/\n\n+/).map((block) => normalizeLinesKeepVerticalStructure(block))
    for (const b of blocks) {
      if (b !== '') out.push(b)
    }
  }
  return out
}

/**
 * Flatten embedded newlines; optionally split very long blobs (PDF/paste).
 * EPUB: use `splitLong: true` with high `maxChunkLen` + `breakSingleNewlines` for NovelFire-style `<br>` lines.
 */
export function formatImportParagraphs(
  paragraphs: string[],
  options?: { splitLong?: boolean; maxChunkLen?: number; breakSingleNewlines?: boolean },
): string[] {
  const splitLong = options?.splitLong !== false
  const maxChunkLen = options?.maxChunkLen ?? 540
  let expanded = expandEmbeddedNewlines(paragraphs)
  if (options?.breakSingleNewlines) {
    expanded = expanded.flatMap((p) => p.split('\n').map((line) => line.replace(/[ \t\f\v]+/g, ' ').trimEnd()))
  }
  if (!splitLong) {
    return expanded.map((p) => normalizeLinesKeepVerticalStructure(p)).filter((p) => p !== '')
  }
  return expanded.flatMap((p) => splitLongParagraph(p, maxChunkLen))
}
