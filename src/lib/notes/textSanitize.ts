/** Sanitize note metadata (title, tags, folder names) — not body text. */

export const METADATA_MAX_LEN = 64

/** U+2028/U+2029 break JSON in some parsers — strip everywhere before sync. */
export function stripJsonUnsafe(s: string): string {
  return s.replace(/\u2028|\u2029/g, ' ')
}

/** Null, BIDI overrides, zero-width — metadata only. */
export function stripMetadataControls(s: string): string {
  return s
    .replace(/\0/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
}

export function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]*>/g, '')
}

/** Title / tag / folder name — strip controls, HTML, truncate. */
export function sanitizeMetadataText(raw: string, maxLen = METADATA_MAX_LEN): string {
  let s = stripJsonUnsafe(stripMetadataControls(stripHtmlTags(raw)))
  s = s.trim()
  if (s.length > maxLen) s = s.slice(0, maxLen)
  return s
}

export function sanitizeTags(tags: string[]): string[] {
  const out: string[] = []
  for (const t of tags) {
    const clean = sanitizeMetadataText(t)
    if (clean && !out.includes(clean)) out.push(clean)
  }
  return out
}

/** Safe display for history detail strings (may contain user-supplied text). */
export function sanitizeHistoryDetail(raw: string): string {
  const s = sanitizeMetadataText(raw, 120)
  return s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return c
    }
  })
}

/** Strip JSON-unsafe chars from session fields before push (body included). */
export function sanitizeSessionForSync<T extends { title?: string; notes?: string; tags?: string[] }>(
  s: T,
): T {
  return {
    ...s,
    title: s.title != null ? stripJsonUnsafe(sanitizeMetadataText(s.title, 200)) : s.title,
    notes: s.notes != null ? stripJsonUnsafe(s.notes) : s.notes,
    tags: Array.isArray(s.tags) ? sanitizeTags(s.tags) : s.tags,
  }
}
