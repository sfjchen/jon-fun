/** Double-tap / caret helpers for the in-context reader. */

/**
 * [start, end) word range at a character offset in `text` (whitespace-bounded).
 */
export function wordRangeInParagraph(text: string, offset: number): { start: number; end: number } | null {
  const t = text
  if (!t.length) return null
  let o = Math.max(0, Math.min(offset, t.length))
  if (o === t.length) o = t.length - 1
  if (/\s/.test(t[o]!)) {
    if (o > 0 && !/\s/.test(t[o - 1]!)) o -= 1
    else return null
  }
  let s = o
  while (s > 0 && !/\s/.test(t[s - 1]!)) s--
  let e = o + 1
  while (e < t.length && !/\s/.test(t[e]!)) e++
  if (e <= s) return null
  return { start: s, end: e }
}

export function getTextOffsetInElement(el: HTMLElement, clientX: number, clientY: number): number | null {
  const d = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (d.caretRangeFromPoint) {
    const r = d.caretRangeFromPoint(clientX, clientY)
    if (!r || !el.contains(r.startContainer)) return null
    const pre = document.createRange()
    pre.selectNodeContents(el)
    pre.setEnd(r.startContainer, r.startOffset)
    return pre.toString().length
  }
  if (d.caretPositionFromPoint) {
    const c = d.caretPositionFromPoint(clientX, clientY)
    if (!c || !c.offsetNode || !el.contains(c.offsetNode)) return null
    const pre = document.createRange()
    pre.selectNodeContents(el)
    pre.setEnd(c.offsetNode, c.offset)
    return pre.toString().length
  }
  return null
}
