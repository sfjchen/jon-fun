/**
 * Replace TINAD (There Is No Antimemetics Division) “Section I” body chapters in a
 * portable library JSON with SCP Wiki originals (CC BY-SA 3.0), preserving chapter ids
 * so IndexedDB progress/bookmarks stay valid after re-import.
 *
 * Sources: data/reader/tinad-wiki-raw/*.md (export dumps from scp-wiki.wikidot.com).
 *
 * Usage: npx tsx scripts/patch-tinad-wiki-section1-portable.ts [path/to/reader-library-portable.json]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePortableLibrary, stringifyPortableLibrary } from '../src/lib/reader/library-portable'
import { formatImportParagraphs } from '../src/lib/reader/paragraph-format'
import type { ReaderChapter, ReaderPublication } from '../src/lib/reader/types'

const RAW_DIR = join(process.cwd(), 'data/reader/tinad-wiki-raw')

const TALES: {
  file: string
  chapterId: string
  title: string
  cite: string
  url: string
}[] = [
  {
    file: 'we-need-to-talk-about-fifty-five.md',
    chapterId: '1-induction-1288f6b5',
    title: '1: We Need To Talk About Fifty-Five',
    cite: 'We Need To Talk About Fifty-Five',
    url: 'https://scp-wiki.wikidot.com/we-need-to-talk-about-fifty-five',
  },
  {
    file: 'introductory-antimemetics.md',
    chapterId: '2-introductory-antimemetics-8d1ccc6a',
    title: '2: Introductory Antimemetics',
    cite: 'Introductory Antimemetics',
    url: 'https://scp-wiki.wikidot.com/introductory-antimemetics',
  },
  {
    file: 'unforgettable-that-s-what-you-are.md',
    chapterId: '3-unforgettable-that-s-what-you-are-7d9f6a9c',
    title: '3: Unforgettable, That’s What You Are',
    cite: "Unforgettable, That's What You Are",
    url: 'https://scp-wiki.wikidot.com/unforgettable-that-s-what-you-are',
  },
]

const NOTE =
  'Chapters 1–3 after front matter use SCP Wiki “original” tale text (CC BY-SA 3.0) from scp-wiki.wikidot.com — publisher EPUB uses revised names (UO/Unknowns vs Foundation/SCPs).'

function extractTaleMarkdown(md: string): string {
  const lines = md.split(/\n/)
  const startBy = lines.findIndex((l) => l.trim() === 'by qntm')
  if (startBy < 0) throw new Error('Could not find tale start (line "by qntm").')

  const body: string[] = []
  for (let i = startBy + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const t = line.trim()
    if (/^\*\*Next:/.test(t)) break
    if (t === '‡ Licensing / Citation') break
    if (t.startsWith('Cite this page as:')) break
    if (t.startsWith('_licensebox')) break
    body.push(line)
  }

  while (body.length && !body[0]?.trim()) body.shift()
  while (body.length && !body[body.length - 1]?.trim()) body.pop()
  return body.join('\n')
}

/** Merge contiguous Markdown blockquote lines into normal paragraphs. */
function flattenBlockquotes(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let q: string[] = []

  const flushQ = () => {
    if (!q.length) return
    out.push(q.join(' '))
    q = []
  }

  for (const line of lines) {
    if (line.startsWith('>')) {
      q.push(line.replace(/^>\s?/, '').trim())
    } else {
      flushQ()
      out.push(line)
    }
  }
  flushQ()
  return out.join('\n')
}

function wikidotUnescape(text: string): string {
  return text.replace(/\\([.#!])/g, '$1')
}

function roughParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
}

function countWords(paragraphs: string[]): number {
  return paragraphs.reduce((sum, p) => sum + p.trim().split(/\s+/).filter(Boolean).length, 0)
}

function paragraphsFromWikiFile(absPath: string, cite: string, url: string): string[] {
  const md = readFileSync(absPath, 'utf8')
  let raw = extractTaleMarkdown(md)
  raw = flattenBlockquotes(raw)
  raw = wikidotUnescape(raw)
  const blocks = roughParagraphs(raw)
  let formatted = formatImportParagraphs(blocks, { splitLong: true, maxChunkLen: 960 })
  formatted = formatted.map((p) => (p === '\\*' ? '* * *' : p))
  const license = `[Wiki source — CC BY-SA 3.0] “${cite}” by qntm. ${url}`
  return [license, ...formatted]
}

function patchPublication(pub: ReaderPublication): ReaderPublication {
  if (pub.title !== 'There Is No Antimemetics Division') return pub

  const idToParas = new Map<string, string[]>()
  const idToTitle = new Map<string, string>()

  for (const tale of TALES) {
    const abs = join(RAW_DIR, tale.file)
    idToParas.set(tale.chapterId, paragraphsFromWikiFile(abs, tale.cite, tale.url))
    idToTitle.set(tale.chapterId, tale.title)
  }

  const chapters = pub.chapters.map((ch) => {
    const paras = idToParas.get(ch.id)
    const newTitle = idToTitle.get(ch.id)
    if (!paras || newTitle === undefined) return ch
    const next: ReaderChapter = {
      ...ch,
      title: newTitle,
      paragraphs: paras,
      wordCount: countWords(paras),
    }
    return next
  })

  const notes = [...(pub.importNotes ?? [])]
  if (!notes.some((n) => n.includes('SCP Wiki') && n.includes('Section'))) {
    notes.unshift(NOTE)
  }

  return { ...pub, chapters, importNotes: notes }
}

function main(): void {
  const libPath = process.argv[2] ?? join(process.cwd(), 'reader-library-portable.json')
  const json = readFileSync(libPath, 'utf8')
  const pubs = parsePortableLibrary(json)
  const patched = pubs.map(patchPublication)
  writeFileSync(libPath, stringifyPortableLibrary(patched), 'utf8')
  console.log('Patched TINAD Section I wiki chapters in', libPath)
}

main()
