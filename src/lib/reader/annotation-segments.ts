/** Split paragraph string into non-overlapping segments with style layers. */
export type SegmentLayer = { kind: 'h' | 'c'; id: string }

export type TextSegment = {
  start: number
  end: number
  layers: SegmentLayer[]
}

export function buildTextSegments(
  len: number,
  items: { start: number; end: number; kind: 'h' | 'c'; id: string }[],
): TextSegment[] {
  if (len <= 0) return []
  const points = new Set<number>([0, len])
  for (const it of items) {
    const a = Math.max(0, Math.min(len, it.start))
    const b = Math.max(0, Math.min(len, it.end))
    if (a < b) {
      points.add(a)
      points.add(b)
    }
  }
  const sorted = [...points].sort((a, b) => a - b)
  const segs: TextSegment[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (a === b) continue
    const layers: SegmentLayer[] = []
    for (const it of items) {
      const s = Math.max(0, Math.min(len, it.start))
      const e = Math.max(0, Math.min(len, it.end))
      if (s < e && s < b && e > a) layers.push({ kind: it.kind, id: it.id })
    }
    segs.push({ start: a, end: b, layers })
  }
  return segs
}
