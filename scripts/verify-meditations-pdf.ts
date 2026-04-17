/**
 * CI / local guard: full PDF extract + chapterize for the Meditations fixture.
 * Run: npm run verify:meditations-pdf
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractPdfTextFromBuffer } from '../src/lib/reader/pdf-extract-server'
import { chapterizeText } from '../src/lib/reader/text-chapters'

const FIXTURE = join(process.cwd(), 'e2e/fixtures/meditations-a-new-translation-hardcover.pdf')

async function main(): Promise<void> {
  const buf = readFileSync(FIXTURE)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const { text } = await extractPdfTextFromBuffer(ab)
  const chapters = chapterizeText(text, 'pdf')

  const failures: string[] = []
  if (chapters.length !== 12) failures.push(`expected 12 chapters, got ${chapters.length}`)

  const first = chapters[0]
  if (!first) failures.push('no chapters')
  else {
    if (!/book\s*1/i.test(first.title)) failures.push(`first chapter title: ${first.title}`)
    if (first.wordCount < 3000) failures.push(`Book 1 word count too low: ${first.wordCount} (expected ≥3000)`)
  }

  const last = chapters[chapters.length - 1]
  if (last && !/^book\s*12\b/i.test(last.title.trim())) {
    failures.push(`last chapter title should be Book 12: ${last.title}`)
  }

  if (failures.length) {
    console.error('verify-meditations-pdf failed:')
    for (const f of failures) console.error(`  - ${f}`)
    process.exit(1)
  }

  console.log(
    `OK Meditations PDF: ${chapters.length} chapters; Book 1 "${first?.title.slice(0, 40)}…" (${first?.wordCount.toLocaleString()} words)`,
  )
}

void main()
