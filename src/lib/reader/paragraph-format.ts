/**
 * Normalize paragraph list after import so reading UI gets breathable blocks
 * (embedded newlines, very long PDF blobs split at sentence-ish boundaries).
 */

const ABBREV_NO_BREAK = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|Mt|vs|etc|i\.e|e\.g|Fig|Vol|Ch)\.)\s*$/i

function splitLongParagraph(text: string, maxLen = 540): string[] {
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

/** Split on blank lines from source text / EPUB / paste. */
export function expandEmbeddedNewlines(paragraphs: string[]): string[] {
  const out: string[] = []
  for (const p of paragraphs) {
    const blocks = p.split(/\n\n+/).map((x) => x.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
    for (const b of blocks) out.push(b)
  }
  return out
}

/**
 * Flatten embedded newlines; optionally split very long blobs (PDF/paste).
 * EPUBs already have `<p>` boundaries — pass `splitLong: false` to avoid breaking author flow.
 */
export function formatImportParagraphs(paragraphs: string[], options?: { splitLong?: boolean }): string[] {
  const splitLong = options?.splitLong !== false
  const expanded = expandEmbeddedNewlines(paragraphs)
  if (!splitLong) {
    return expanded.map((p) => p.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
  }
  return expanded.flatMap((p) => splitLongParagraph(p))
}
