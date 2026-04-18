import { unzipSync } from 'fflate'
import { XMLParser } from 'fast-xml-parser'
import { parse, HTMLElement as HtmlElement, Node as ParserNode } from 'node-html-parser'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (tagName) => ['item', 'itemref', 'meta', 'dc:creator'].includes(tagName),
})

export type EpubSpineChapter = {
  title: string
  paragraphs: string[]
}

function toStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Resolve href relative to OPF directory inside the ZIP path space (POSIX). */
function resolveOpfRelative(opfDir: string, href: string): string {
  const h = href.replace(/^\//, '')
  const segs = opfDir ? opfDir.split('/').filter(Boolean) : []
  for (const part of h.split('/')) {
    if (part === '..') segs.pop()
    else if (part && part !== '.') segs.push(part)
  }
  return segs.join('/')
}

function findRootfilePath(containerXml: string): string {
  const m = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i)
  if (m?.[1]) return m[1].replace(/\\/g, '/')
  const doc = xmlParser.parse(containerXml) as Record<string, unknown>
  const container = doc.container as Record<string, unknown> | undefined
  const rootfiles = container?.rootfiles as Record<string, unknown> | undefined
  const rootfile = rootfiles?.rootfile
  const list = Array.isArray(rootfile) ? rootfile : rootfile ? [rootfile] : []
  const fullPath = list.map((r: { '@_full-path'?: string }) => r['@_full-path']).find(Boolean)
  if (!fullPath || typeof fullPath !== 'string') throw new Error('EPUB container.xml: missing rootfile full-path.')
  return fullPath.replace(/\\/g, '/')
}

function pickPackageTitle(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return ''
  for (const k of ['dc:title', 'title']) {
    const v = metadata[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string' && item.trim()) return item.trim()
        if (item && typeof item === 'object' && '#text' in item) {
          const t = String((item as { '#text': unknown })['#text']).trim()
          if (t) return t
        }
      }
    }
    if (v && typeof v === 'object' && '#text' in v) {
      const t = String((v as { '#text': unknown })['#text']).trim()
      if (t) return t
    }
  }
  return ''
}

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return []
  return Array.isArray(x) ? x : [x]
}

/** True if `inner` is a strict descendant of `ancestor` (node-html-parser has no `contains()`). */
function isAncestorOf(ancestor: HtmlElement, inner: HtmlElement): boolean {
  let cur: ParserNode | undefined = inner.parentNode
  while (cur) {
    if (cur === ancestor) return true
    cur = cur.parentNode
  }
  return false
}

/** Keep only matches that are not ancestors of another match (avoid parent+child duplicate text). */
function leafElements(container: HtmlElement, selector: string): HtmlElement[] {
  const all = Array.from(container.querySelectorAll(selector)) as HtmlElement[]
  return all.filter((el) => !all.some((other) => other !== el && isAncestorOf(el, other)))
}

function stripXhtmlToParagraphs(xhtml: string): string[] {
  const root = parse(xhtml, { lowerCaseTagName: true })
  root.querySelectorAll('script, style, noscript').forEach((el) => el.remove())
  const body = (root.querySelector('body') ?? root) as HtmlElement

  const blocks: string[] = []
  const pushText = (t: string) => {
    const s = t.replace(/\s+/g, ' ').trim()
    if (s) blocks.push(s)
  }

  /** Reading order: headings + paragraphs (captures section titles + body; avoids losing `<h2>` when `<p>` exists). */
  const flow = body.querySelectorAll('h1, h2, h3, h4, h5, h6, p')
  if (flow.length) {
    for (const el of flow) pushText(el.text)
    if (blocks.length) return blocks
  }

  /**
   * Fallback when there are no `<p>`/heading tags: only **leaf** block nodes so parent `<div>`s
   * do not duplicate all child text (common in trade EPUBs — was breaking anthologies).
   */
  const fallbackSel = 'div, section, article, li, blockquote, td, th, header, aside, main, figure'
  for (const el of leafElements(body, fallbackSel)) pushText(el.text)
  if (blocks.length) return blocks

  pushText(body.text.replace(/\s+/g, ' '))
  return blocks.filter(Boolean)
}

function titleFromXhtml(xhtml: string): string {
  const root = parse(xhtml, { lowerCaseTagName: true }) as HtmlElement
  const t = root.querySelector('title')?.text?.trim()
  if (t) return t
  const h = root.querySelector('h1')?.text?.trim()
  if (h) return h
  return ''
}

/**
 * Parse DRM-free EPUB (ZIP + OPF spine + XHTML). File is not persisted.
 */
export function extractEpubFromBuffer(buffer: ArrayBuffer): {
  packageTitle: string
  chapters: EpubSpineChapter[]
  notes: string[]
} {
  const notes: string[] = [
    'EPUB import uses the package spine (reading order). DRM-protected EPUBs are not supported. Complex layouts, footnotes, and images are reduced to plain text.',
  ]
  const u8 = new Uint8Array(buffer)
  if (u8.length < 4 || u8[0] !== 0x50 || u8[1] !== 0x4b) {
    throw new Error('File does not look like a ZIP (EPUB) archive.')
  }

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(u8, { filter: () => true }) as Record<string, Uint8Array>
  } catch {
    throw new Error('Could not unzip EPUB (corrupt or not a valid ZIP).')
  }

  const normKeys = (path: string) => path.replace(/\\/g, '/').replace(/^\//, '')
  const fileMap: Record<string, Uint8Array> = {}
  for (const [k, v] of Object.entries(files)) {
    fileMap[normKeys(k)] = v
  }

  if (fileMap['META-INF/encryption.xml']) {
    throw new Error('This EPUB appears to use encryption (DRM). Only DRM-free EPUBs are supported.')
  }

  const containerBytes = fileMap['META-INF/container.xml']
  if (!containerBytes) throw new Error('EPUB is missing META-INF/container.xml.')

  const rootfilePath = findRootfilePath(new TextDecoder('utf-8').decode(containerBytes))
  const opfBytes = fileMap[rootfilePath]
  if (!opfBytes) throw new Error(`EPUB missing package file: ${rootfilePath}`)

  const opfDir = rootfilePath.includes('/') ? rootfilePath.slice(0, rootfilePath.lastIndexOf('/')) : ''
  const opfXml = new TextDecoder('utf-8').decode(opfBytes)
  const opf = xmlParser.parse(opfXml) as Record<string, unknown>
  const pkg = (opf.package ?? opf['package']) as Record<string, unknown> | undefined
  if (!pkg) throw new Error('Invalid OPF: no package element.')

  const metadata = pkg.metadata as Record<string, unknown> | undefined
  const packageTitle = pickPackageTitle(metadata)

  const manifest = pkg.manifest as Record<string, unknown> | undefined
  const rawItems = manifest?.item
  const items = asArray(rawItems as Record<string, unknown> | Record<string, unknown>[] | undefined)
  const idToHref = new Map<string, { href: string; mediaType: string }>()
  for (const it of items) {
    const id = toStr(it['@_id'])
    const href = toStr(it['@_href'])
    const mediaType = toStr(it['@_media-type'])
    if (id && href) idToHref.set(id, { href, mediaType })
  }

  const spine = pkg.spine as Record<string, unknown> | undefined
  const rawRefs = spine?.itemref
  const itemrefs = asArray(rawRefs as Record<string, unknown> | Record<string, unknown>[] | undefined)

  const chapters: EpubSpineChapter[] = []
  let skipped = 0

  for (const ref of itemrefs) {
    const linear = ref['@_linear']
    if (linear === 'no') {
      skipped++
      continue
    }
    const idref = toStr(ref['@_idref'])
    if (!idref) continue
    const item = idToHref.get(idref)
    if (!item) continue

    const mt = item.mediaType.toLowerCase()
    if (
      !mt.includes('html') &&
      !mt.includes('xml') &&
      !item.href.toLowerCase().endsWith('.xhtml') &&
      !item.href.toLowerCase().endsWith('.html') &&
      !item.href.toLowerCase().endsWith('.htm')
    ) {
      skipped++
      continue
    }

    const absPath = resolveOpfRelative(opfDir, item.href)
    const docBytes = fileMap[absPath]
    if (!docBytes) {
      notes.push(`Skipped missing spine file: ${absPath}`)
      continue
    }

    const xhtml = new TextDecoder('utf-8').decode(docBytes)
    const paragraphs = stripXhtmlToParagraphs(xhtml)
    if (!paragraphs.length) {
      skipped++
      continue
    }

    let title = titleFromXhtml(xhtml)
    if (!title) title = `Section ${chapters.length + 1}`
    chapters.push({ title, paragraphs })
  }

  if (!chapters.length) {
    throw new Error('No readable chapter content found in EPUB spine (empty or unsupported structure).')
  }

  notes.push(`Imported ${chapters.length} spine section(s) from EPUB.${skipped > 0 ? ` Skipped ${skipped} non-text or non-linear item(s).` : ''}`)
  if (packageTitle) notes.unshift(`Package title: ${packageTitle}`)

  return { packageTitle: packageTitle || 'Untitled EPUB', chapters, notes }
}
