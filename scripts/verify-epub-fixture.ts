/**
 * Smoke test: minimal EPUB fixture → extract → expect 2 spine chapters.
 * Run: npm run verify:epub-fixture
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractEpubFromBuffer } from '../src/lib/reader/epub-extract-server'
import { createEpubImportDraft } from '../src/lib/reader/text-chapters'

const FIXTURE = join(process.cwd(), 'e2e/fixtures/minimal-reader-test.epub')

function main(): void {
  const buf = readFileSync(FIXTURE)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const { packageTitle, chapters, notes } = extractEpubFromBuffer(ab)
  const failures: string[] = []
  if (packageTitle !== 'Minimal Fixture') failures.push(`packageTitle: ${packageTitle}`)
  if (chapters.length !== 2) failures.push(`expected 2 chapters, got ${chapters.length}`)
  if (!chapters[0]?.paragraphs.some((p) => p.includes('First paragraph'))) failures.push('missing ch1 text')
  if (!chapters[1]?.paragraphs.some((p) => p.includes('Alpha'))) failures.push('missing ch2 text')

  const draft = createEpubImportDraft({
    packageTitle,
    spineChapters: chapters,
    originalFileName: 'minimal-reader-test.epub',
    notes,
  })
  if (draft.sourceType !== 'epub') failures.push('draft sourceType')
  if (draft.chapters.length !== 2) failures.push('draft chapters')

  if (failures.length) {
    console.error('verify-epub-fixture failed:', failures)
    process.exit(1)
  }
  console.log('OK EPUB fixture:', draft.title, `(${draft.chapters.length} chapters)`)
}

main()
