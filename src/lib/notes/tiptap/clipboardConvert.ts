import type { JSONContent } from '@tiptap/core'
import { gridToTableContent, looksLikeTabularText } from './tableUtils'

type Mark = { type: string; attrs?: Record<string, unknown> }

const BULLET_LINE_RE =
  /^(\s*)(?:[-*•●◦▪‣⁃]|\u2022|\u2023|\u25AA|\u25E6|\u2043|\u2219)\s+(.*)$/

/** Normalize Unicode / hyphen bullets in plain paste to Notes "- " lines. */
export function normalizePlainPasteText(text: string): string | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let changed = false
  const out = lines.map((line) => {
    const m = line.match(BULLET_LINE_RE)
    if (m) {
      const next = `${m[1] ?? ''}- ${m[2] ?? ''}`
      if (next !== line) changed = true
      return next
    }
    return line
  })
  return changed ? out.join('\n') : null
}

/** True when plain text is mostly bullet lines (tabs can fake spreadsheet columns). */
export function looksLikeBulletListText(text: string): boolean {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim())
  if (!lines.length) return false
  let bullets = 0
  for (const line of lines) {
    const stripped = line.replace(/^\t+/, '')
    if (BULLET_LINE_RE.test(line) || BULLET_LINE_RE.test(stripped)) bullets++
  }
  return bullets >= Math.max(1, Math.ceil(lines.length * 0.5))
}

function mergeAdjacentText(nodes: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = []
  for (const node of nodes) {
    if (node.type !== 'text' || !node.text) continue
    const prev = out[out.length - 1]
    const marksKey = JSON.stringify(node.marks ?? [])
    const prevKey = prev?.type === 'text' ? JSON.stringify(prev.marks ?? []) : ''
    if (prev?.type === 'text' && marksKey === prevKey) {
      prev.text = (prev.text ?? '') + node.text
    } else {
      out.push({ ...node })
    }
  }
  return out
}

function marksFromElement(el: Element, inherited: Mark[]): Mark[] {
  let marks = [...inherited]
  const tag = el.tagName.toUpperCase()
  const style = el.getAttribute('style') ?? ''

  if (tag === 'STRONG' || tag === 'B' || /font-weight:\s*(700|bold)/i.test(style)) {
    marks = dedupeMarks([...marks, { type: 'bold' }])
  }
  if (tag === 'EM' || tag === 'I' || /font-style:\s*italic/i.test(style)) {
    marks = dedupeMarks([...marks, { type: 'italic' }])
  }
  if (tag === 'U' || /text-decoration:\s*underline/i.test(style)) {
    marks = dedupeMarks([...marks, { type: 'underline' }])
  }
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || /line-through/i.test(style)) {
    marks = dedupeMarks([...marks, { type: 'strike' }])
  }
  if (tag === 'CODE') marks = dedupeMarks([...marks, { type: 'code' }])
  if (tag === 'A') {
    const href = el.getAttribute('href')?.trim()
    if (href) marks = dedupeMarks([...marks, { type: 'link', attrs: { href } }])
  }
  return marks
}

function dedupeMarks(marks: Mark[]): Mark[] {
  const seen = new Set<string>()
  return marks.filter((m) => {
    const k = `${m.type}:${JSON.stringify(m.attrs ?? {})}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function inlineFromNodes(nodes: NodeListOf<ChildNode> | ChildNode[], inherited: Mark[] = []): JSONContent[] {
  const out: JSONContent[] = []
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? ''
      if (!t) continue
      out.push({
        type: 'text',
        text: t,
        ...(inherited.length ? { marks: inherited.map((m) => ({ ...m })) } : {}),
      })
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    const el = node as Element
    const tag = el.tagName.toUpperCase()
    if (tag === 'BR') {
      out.push({ type: 'hardBreak' })
      continue
    }
    if (tag === 'META' || tag === 'STYLE' || tag === 'SCRIPT' || tag === 'HEAD') continue
    if (tag === 'UL' || tag === 'OL' || tag === 'TABLE') continue
    const marks = marksFromElement(el, inherited)
    out.push(...inlineFromNodes(el.childNodes, marks))
  }
  return mergeAdjacentText(out)
}

function isBlankInline(inline: JSONContent[]): boolean {
  if (!inline.length) return true
  return inline.every(
    (n) =>
      n.type === 'hardBreak' ||
      (n.type === 'text' && !(n.text ?? '').replace(/\u00a0/g, ' ').trim()),
  )
}

function emptyParagraph(): JSONContent {
  return { type: 'paragraph' }
}

function breakOnlyParagraph(): JSONContent {
  return { type: 'paragraph', content: [{ type: 'hardBreak' }] }
}

function blankParagraphFromInline(inline: JSONContent[]): JSONContent {
  if (!inline.length) return emptyParagraph()
  if (
    inline.every(
      (n) =>
        n.type === 'hardBreak' ||
        (n.type === 'text' && !(n.text ?? '').replace(/\u00a0/g, ' ').trim()),
    ) &&
    inline.some((n) => n.type === 'hardBreak')
  ) {
    return breakOnlyParagraph()
  }
  return emptyParagraph()
}

function paragraphNode(inline: JSONContent[]): JSONContent {
  if (isBlankInline(inline)) return blankParagraphFromInline(inline)
  return { type: 'paragraph', content: inline }
}

function paragraphWithPrefix(indent: string, prefix: string, inline: JSONContent[]): JSONContent {
  const lead: JSONContent = { type: 'text', text: `${indent}${prefix}` }
  const content = inline.length ? [lead, ...inline] : [lead]
  return { type: 'paragraph', content: mergeAdjacentText(content) }
}

function parseIndentPx(style: string): number {
  const m = style.match(/(?:margin-left|padding-left|text-indent)\s*:\s*([^;]+)/i)
  if (!m) return 0
  const v = m[1]!.trim()
  const num = parseFloat(v)
  if (Number.isNaN(num)) return 0
  if (/pt/i.test(v)) return num * (96 / 72)
  if (/em/i.test(v)) return num * 16
  return num
}

/** Google Docs flat lists indent li via margin-left (~36px per level). */
function marginIndentDepth(el: Element): number {
  const px = parseIndentPx(el.getAttribute('style') ?? '')
  if (px <= 0) return 0
  return Math.max(0, Math.round(px / 36))
}

function listItemBlocks(li: Element, depth: number, prefix: string): JSONContent[] {
  const indent = '  '.repeat(depth)
  const clone = li.cloneNode(true) as Element
  clone.querySelectorAll('ul, ol').forEach((n) => n.remove())
  const inline = inlineFromNodes(clone.childNodes)
  const blocks: JSONContent[] = [paragraphWithPrefix(indent, prefix, inline)]

  for (const child of li.children) {
    const tag = child.tagName.toUpperCase()
    if (tag === 'UL') blocks.push(...listBlocks(child as Element, depth + 1, false))
    if (tag === 'OL') blocks.push(...listBlocks(child as Element, depth + 1, true))
  }
  return blocks
}

function listBlocks(list: Element, depth: number, ordered: boolean): JSONContent[] {
  const blocks: JSONContent[] = []
  let n = 0
  for (const child of list.children) {
    const tag = child.tagName.toUpperCase()
    if (tag === 'LI') {
      n++
      const prefix = ordered ? `${n}. ` : '- '
      const marginDepth = marginIndentDepth(child as Element)
      const itemDepth = marginDepth > 0 ? marginDepth : depth
      blocks.push(...listItemBlocks(child as Element, itemDepth, prefix))
    } else if (tag === 'UL') {
      blocks.push(...listBlocks(child as Element, depth + 1, false))
    } else if (tag === 'OL') {
      blocks.push(...listBlocks(child as Element, depth + 1, true))
    }
  }
  return blocks
}

function tableRows(table: Element): Element[] {
  return [...table.querySelectorAll('tr')]
}

function tableRowCells(tr: Element): Element[] {
  return [...tr.querySelectorAll('th, td')]
}

/** Layout/spacer tables from Google Docs — not real data grids. */
function isLayoutTable(table: Element): boolean {
  if (table.querySelector('ul, ol')) return true
  const rows = tableRows(table)
  if (!rows.length) return true
  if (rows.every((tr) => tableRowCells(tr).length <= 1)) return true

  const nonEmptyPerRow = rows.map(
    (tr) => tableRowCells(tr).filter((c) => (c.textContent ?? '').replace(/\u00a0/g, ' ').trim()).length,
  )
  if (nonEmptyPerRow.every((n) => n <= 1)) return true

  const allRows = rows.map((tr) => tableRowCells(tr))
  if (Math.max(...allRows.map((r) => r.length), 0) >= 2) {
    const leadingSpacers = allRows.every((row) => {
      if (row.length < 2) return true
      return row.slice(0, -1).every((c) => !(c.textContent ?? '').replace(/\u00a0/g, ' ').trim())
    })
    if (leadingSpacers) return true
  }

  return false
}

function layoutTableToBlocks(table: Element): JSONContent[] {
  const blocks: JSONContent[] = []
  for (const tr of tableRows(table)) {
    const cells = tableRowCells(tr)
    if (!cells.length) continue

    if (cells.some((c) => c.querySelector('ul, ol'))) {
      for (const cell of cells) blocks.push(...blocksFromNodes(cell.childNodes))
      continue
    }

    const leadEmpty = cells.length > 1 && cells.slice(0, -1).every((c) => !(c.textContent ?? '').replace(/\u00a0/g, ' ').trim())
    const contentCell = leadEmpty ? cells[cells.length - 1]! : cells[0]!
    const spacerDepth = leadEmpty ? cells.length - 1 : 0
    const padDepth = marginIndentDepth(contentCell)
    const totalDepth = spacerDepth + padDepth

    const text = (contentCell.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text) {
      const bm = text.match(BULLET_LINE_RE)
      if (bm) {
        const base = Math.floor((bm[1]?.length ?? 0) / 2)
        const indent = '  '.repeat(totalDepth + base)
        blocks.push(paragraphWithPrefix(indent, '- ', [{ type: 'text', text: bm[2] ?? '' }]))
        continue
      }
    }

    const cellBlocks = blocksFromNodes(contentCell.childNodes)
    if (cellBlocks.length) {
      blocks.push(...addDepthToDashBlocks(convertBulletParagraphs(cellBlocks), totalDepth))
      continue
    }

    if (text) {
      const indent = '  '.repeat(totalDepth)
      blocks.push({ type: 'paragraph', content: [{ type: 'text', text: `${indent}${text}` }] })
    }
  }
  return blocks
}

function convertBulletParagraphs(blocks: JSONContent[]): JSONContent[] {
  return blocks.map((b) => {
    if (b.type !== 'paragraph' || !b.content?.length) return b
    const text = b.content
      .filter((n) => n.type === 'text')
      .map((n) => n.text ?? '')
      .join('')
    const m = text.match(BULLET_LINE_RE)
    if (!m) return b
    const marks = b.content.flatMap((n) => (n.type === 'text' ? (n.marks ?? []) : []))
    const inline: JSONContent[] = [{ type: 'text', text: m[2] ?? '', ...(marks.length ? { marks } : {}) }]
    return paragraphWithPrefix(m[1] ?? '', '- ', inline)
  })
}

function addDepthToDashBlocks(blocks: JSONContent[], extraDepth: number): JSONContent[] {
  if (extraDepth <= 0) return blocks
  const pad = '  '.repeat(extraDepth)
  return blocks.map((b) => {
    if (b.type !== 'paragraph' || !b.content?.length) return b
    const first = b.content[0]
    if (first?.type !== 'text' || !/^(\s*)- /.test(first.text ?? '')) return b
    const m = (first.text ?? '').match(/^(\s*)- (.*)$/)
    if (!m) return b
    const nextText = `${pad}${m[1] ?? ''}- ${m[2] ?? ''}`
    return { ...b, content: [{ ...first, text: nextText }, ...b.content.slice(1)] }
  })
}

function tableFromElement(table: Element): JSONContent | null {
  if (isLayoutTable(table)) return null

  const grid: string[][] = []
  for (const tr of tableRows(table)) {
    const cells = tableRowCells(tr).map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
    if (cells.some((c) => c.length > 0)) grid.push(cells)
  }
  if (grid.length < 1) return null
  const withHeader = table.querySelector('tr')?.querySelector('th') != null
  return gridToTableContent(grid, withHeader)
}

function blocksFromMixedElement(el: Element): JSONContent[] {
  const blocks: JSONContent[] = []
  let pending: ChildNode[] = []

  const flush = () => {
    if (!pending.length) return
    const inline = inlineFromNodes(pending)
    if (isBlankInline(inline)) blocks.push(blankParagraphFromInline(inline))
    else if (inline.length) blocks.push(paragraphNode(inline))
    pending = []
  }

  for (const node of el.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as Element
      const t = child.tagName.toUpperCase()
      if (t === 'UL' || t === 'OL' || t === 'TABLE') {
        flush()
        blocks.push(...blockFromElement(child))
        continue
      }
    }
    pending.push(node)
  }
  flush()
  return blocks
}

function blockFromElement(el: Element): JSONContent[] {
  const tag = el.tagName.toUpperCase()
  if (tag === 'UL') return listBlocks(el, 0, false)
  if (tag === 'OL') return listBlocks(el, 0, true)
  if (tag === 'TABLE') {
    if (isLayoutTable(el)) return layoutTableToBlocks(el)
    const t = tableFromElement(el)
    return t ? [t] : layoutTableToBlocks(el)
  }
  if (/^H[1-3]$/.test(tag)) {
    const level = Number(tag[1])
    const inline = inlineFromNodes(el.childNodes)
    return [{ type: 'heading', attrs: { level }, content: inline.length ? inline : [{ type: 'text', text: '' }] }]
  }
  if (tag === 'LI') return listItemBlocks(el, 0, '- ')
  if (tag === 'P' || tag === 'DIV' || tag === 'ARTICLE' || tag === 'SECTION' || tag === 'BLOCKQUOTE') {
    if (el.querySelector('ul, ol, table')) return blocksFromMixedElement(el)
    const inline = inlineFromNodes(el.childNodes)
    if (isBlankInline(inline)) return [blankParagraphFromInline(inline)]
    if (!inline.length) return [emptyParagraph()]
    return [paragraphNode(inline)]
  }
  if (tag === 'BR') return [breakOnlyParagraph()]
  const nested = blocksFromNodes(el.childNodes)
  if (nested.length) return nested
  const inline = inlineFromNodes(el.childNodes)
  return inline.length ? [paragraphNode(inline)] : []
}

function unwrapContainer(el: Element): Element[] {
  const tag = el.tagName.toUpperCase()
  const id = el.getAttribute('id') ?? ''
  const isDocsWrapper =
    (tag === 'B' && id.startsWith('docs-internal-guid')) ||
    (tag === 'DIV' && id.startsWith('docs-internal-guid'))
  if (isDocsWrapper) {
    return [...el.childNodes].flatMap((n) => (n.nodeType === Node.ELEMENT_NODE ? unwrapContainer(n as Element) : []))
  }
  return [el]
}

function blocksFromNodes(nodes: NodeListOf<ChildNode> | ChildNode[]): JSONContent[] {
  const blocks: JSONContent[] = []
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? '').replace(/\r\n/g, '\n')
      if (!t.trim()) continue
      for (const line of t.split('\n')) {
        blocks.push(line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : emptyParagraph())
      }
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    for (const el of unwrapContainer(node as Element)) {
      blocks.push(...blockFromElement(el))
    }
  }
  return blocks
}

function isBlankishParagraph(b: JSONContent): boolean {
  if (b.type !== 'paragraph') return false
  if (!b.content?.length) return true
  return isBlankInline(b.content)
}

function hasHardBreakOnly(b: JSONContent): boolean {
  if (b.type !== 'paragraph' || !b.content?.length) return false
  return b.content.some((n) => n.type === 'hardBreak')
}

function blankKind(b: JSONContent): 'empty' | 'break-only' | null {
  if (!isBlankishParagraph(b)) return null
  if (!b.content?.length) return 'empty'
  if (hasHardBreakOnly(b)) return 'break-only'
  return 'empty'
}

function normalizeBlankParagraph(b: JSONContent): JSONContent {
  return blankKind(b) ? emptyParagraph() : b
}

/**
 * Google Docs often encodes one blank line as empty <p> plus <p><br></p>.
 * Collapse mixed blank runs to a single empty paragraph; keep consecutive empty paragraphs.
 */
export function collapseRedundantBlankBlocks(blocks: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = []
  let blankRun: JSONContent[] = []

  const flushBlankRun = () => {
    if (!blankRun.length) return
    const kinds = blankRun.map((b) => blankKind(b))
    const hasBreakOnly = kinds.some((k) => k === 'break-only')
    const hasEmpty = kinds.some((k) => k === 'empty')
    if (hasBreakOnly && hasEmpty) {
      out.push(emptyParagraph())
    } else if (hasBreakOnly) {
      out.push(emptyParagraph())
    } else {
      for (const _ of blankRun) out.push(emptyParagraph())
    }
    blankRun = []
  }

  for (const b of blocks) {
    if (isBlankishParagraph(b)) {
      blankRun.push(b)
      continue
    }
    flushBlankRun()
    out.push(b)
  }
  flushBlankRun()
  return out.map(normalizeBlankParagraph)
}

function dedupeGoogleBlankElements(root: Element): void {
  const blocks = [...root.children]
  for (let i = 0; i < blocks.length - 1; i++) {
    const a = blocks[i]!
    const b = blocks[i + 1]!
    if (!isBlankParagraphElement(a) || !isBlankParagraphElement(b)) continue
    const aEmpty = isEmptyParagraphElement(a)
    const bEmpty = isEmptyParagraphElement(b)
    const aBr = isBrOnlyParagraphElement(a)
    const bBr = isBrOnlyParagraphElement(b)
    if ((aEmpty && bBr) || (aBr && bEmpty) || (aBr && bBr)) {
      b.remove()
      blocks.splice(i + 1, 1)
    }
  }
}

function isBlankParagraphElement(el: Element): boolean {
  const tag = el.tagName.toUpperCase()
  if (tag !== 'P' && tag !== 'DIV') return false
  return isEmptyParagraphElement(el) || isBrOnlyParagraphElement(el)
}

function isEmptyParagraphElement(el: Element): boolean {
  const text = (el.textContent ?? '').replace(/\u00a0/g, '').trim()
  return !text && !el.querySelector('br')
}

function isBrOnlyParagraphElement(el: Element): boolean {
  const text = (el.textContent ?? '').replace(/\u00a0/g, '').trim()
  return !text && el.querySelector('br') != null
}

/** Convert clipboard HTML (Google Docs, Sheets, web) to Tiptap block nodes. Browser only. */
export function htmlPasteToContent(html: string): JSONContent[] | null {
  if (typeof DOMParser === 'undefined') return null
  const trimmed = html.trim()
  if (!trimmed) return null

  const doc = new DOMParser().parseFromString(trimmed, 'text/html')
  dedupeGoogleBlankElements(doc.body)
  const blocks = collapseRedundantBlankBlocks(blocksFromNodes(doc.body.childNodes))
  if (!blocks.length) return null

  const hasStructure = blocks.some(
    (b) =>
      b.type === 'table' ||
      b.type === 'heading' ||
      (b.type === 'paragraph' &&
        (b.content?.some((n) => (n.marks?.length ?? 0) > 0) ||
          (b.content?.[0]?.type === 'text' && /^(\s*)- /.test(b.content[0].text ?? '')))),
  )
  const plain = (doc.body.textContent ?? '').trim()
  if (!hasStructure && plain.length < 2) return null

  return blocks
}

function plainLinesToContent(text: string): JSONContent[] {
  return text.split('\n').map((line) => {
    if (!line) return emptyParagraph()
    return { type: 'paragraph' as const, content: [{ type: 'text' as const, text: line }] }
  })
}

/** Build insertable blocks from clipboard HTML + plain text. Returns null to defer to other handlers. */
export function clipboardToEditorContent(html: string | null | undefined, plain: string): JSONContent[] | null {
  const htmlTrim = html?.trim() ?? ''

  if (htmlTrim && /<table[\s>]/i.test(htmlTrim)) {
    const fromHtml = htmlPasteToContent(htmlTrim)
    if (fromHtml?.length) return fromHtml
  }

  if (plain && looksLikeTabularText(plain) && !looksLikeBulletListText(plain)) return null

  if (htmlTrim && /<(?:p|ul|ol|li|h[1-3]|div|table|strong|em|b|i|span)[\s>]/i.test(htmlTrim)) {
    const fromHtml = htmlPasteToContent(htmlTrim)
    if (fromHtml?.length) return fromHtml
  }

  const normalized = normalizePlainPasteText(plain)
  if (normalized) return plainLinesToContent(normalized)

  return null
}
