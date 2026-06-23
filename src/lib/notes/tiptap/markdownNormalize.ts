/** Normalize markdown for stable external↔editor sync comparisons. */
export function normalizeNotesMarkdown(md: string): string {
  return md.replace(/\r\n/g, '\n').replace(/\n+$/, '')
}
