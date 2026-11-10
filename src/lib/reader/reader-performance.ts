/** Dev / Speed Insights hooks: marks first meaningful reader paint. */

const MARK = 'reader:first-content'

export function markReaderContentPaint(): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return
  try {
    performance.mark(MARK)
  } catch {
    /* ignore */
  }
}
