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

export function measureReaderContentPaint(): number | null {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return null
  try {
    performance.measure('reader:content', MARK)
    const entries = performance.getEntriesByName('reader:content')
    const last = entries[entries.length - 1]
    return last && 'duration' in last ? (last as PerformanceEntry).duration : null
  } catch {
    return null
  }
}
