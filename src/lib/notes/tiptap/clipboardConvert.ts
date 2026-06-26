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

function paragraphNode(inline: JSONContent[]): JSONContent {
  if (!inline.length) return { type: 'paragraph' }
  return { type: 'paragraph', content: inline }
}

function paragraphWithPrefix(indent: string, prefix: string, inline: JSONContent[]): JSONContent {
  const lead: JSONContent = { type: 'text', text: `${indent}${prefix}` }
  const content = inline.length ? [lead, ...inline] : [lead]
  return { type: 'paragraph', content: mergeAdjacentText(content) }
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
    if (child.tagName.toUpperCase() !== 'LI') continue
    n++
    const prefix = ordered ? `${n}. ` : '- '
    blocks.push(...listItemBlocks(child as Element, depth, prefix))
  }
  return blocks
}

function tableFromElement(table: Element): JSONContent | null {
  const grid: string[][] = []
  for (const tr of table.querySelectorAll('tr')) {
    const cells = [...tr.querySelectorAll('th, td')].map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
    if (cells.some((c) => c.length > 0)) grid.push(cells)
  }
  if (grid.length < 1) return null
  const withHeader = table.querySelector('tr')?.querySelector('th') != null
  return gridToTableContent(grid, withHeader)
}

function blockFromElement(el: Element): JSONContent[] {
  const tag = el.tagName.toUpperCase()
  if (tag === 'UL') return listBlocks(el, 0, false)
  if (tag === 'OL') return listBlocks(el, 0, true)
  if (tag === 'TABLE') {
    const t = tableFromElement(el)
    return t ? [t] : []
  }
  if (/^H[1-3]$/.test(tag)) {
    const level = Number(tag[1])
    const inline = inlineFromNodes(el.childNodes)
    return [{ type: 'heading', attrs: { level }, content: inline.length ? inline : [{ type: 'text', text: '' }] }]
  }
  if (tag === 'LI') return listItemBlocks(el, 0, '- ')
  if (tag === 'P' || tag === 'DIV' || tag === 'ARTICLE' || tag === 'SECTION' || tag === 'BLOCKQUOTE') {
    const inline = inlineFromNodes(el.childNodes)
    if (!inline.length && !el.querySelector('ul, ol, table')) return [{ type: 'paragraph' }]
    return [paragraphNode(inline)]
  }
  if (tag === 'BR') return [{ type: 'paragraph', content: [{ type: 'hardBreak' }] }]
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
        blocks.push({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })
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

/** Convert clipboard HTML (Google Docs, Sheets, web) to Tiptap block nodes. Browser only. */
export function htmlPasteToContent(html: string): JSONContent[] | null {
  if (typeof DOMParser === 'undefined') return null
  const trimmed = html.trim()
  if (!trimmed) return null

  const doc = new DOMParser().parseFromString(trimmed, 'text/html')
  const blocks = blocksFromNodes(doc.body.childNodes)
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
    if (!line) return { type: 'paragraph' as const }
    return { type: 'paragraph' as const, content: [{ type: 'text' as const, text: line }] }
  })
}

/** Build insertable blocks from clipboard HTML + plain text. Returns null to defer to other handlers. */
export function clipboardToEditorContent(html: string | null | undefined, plain: string): JSONContent[] | null {
  const htmlTrim = html?.trim() ?? ''

  if (htmlTrim && /<table[\s>]/i.test(htmlTrim)) {
    const fromHtml = htmlPasteToContent(htmlTrim)
    if (fromHtml?.some((b) => b.type === 'table')) return fromHtml
  }

  if (plain && looksLikeTabularText(plain)) return null

  if (htmlTrim && /<(?:p|ul|ol|li|h[1-3]|div|table|strong|em|b|i|span)[\s>]/i.test(htmlTrim)) {
    const fromHtml = htmlPasteToContent(htmlTrim)
    if (fromHtml?.length) return fromHtml
  }

  const normalized = normalizePlainPasteText(plain)
  if (normalized) return plainLinesToContent(normalized)

  return null
}
