/**
 * Writes public/reader/library-curated.json from the TINAD EPUB in e2e/fixtures/ (when present).
 * Same stable publication id as seed:reader-portable / sync:reader-communal-fixtures so merges dedupe.
 *
 * After build, optional wiki Section I text:
 *   npx tsx scripts/patch-tinad-wiki-section1-portable.ts public/reader/library-curated.json
 *
 * Usage: npx tsx scripts/build-reader-library-curated.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { v5 as uuidv5 } from 'uuid'
import { extractEpubFromBuffer } from '../src/lib/reader/epub-extract-server'
import { createEpubImportDraft } from '../src/lib/reader/text-chapters'
import { stringifyPortableLibrary } from '../src/lib/reader/library-portable'
import type { ReaderPublication } from '../src/lib/reader/types'

const TINAD_FILE =
  'There Is No Antimemetics Division (qntm) (z-library.sk, 1lib.sk, z-lib.sk).epub'
const FIXTURES_DIR = join(process.cwd(), 'e2e/fixtures')
const OUT = join(process.cwd(), 'public/reader/library-curated.json')
const SEED_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

function stablePublicationId(fileName: string): string {
  return uuidv5(`sfjc-reader-seed:${fileName}`, SEED_UUID_NAMESPACE)
}

function publicationFromEpub(absPath: string, fileName: string): ReaderPublication {
  const buf = readFileSync(absPath)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const { packageTitle, chapters, notes } = extractEpubFromBuffer(ab)
  const draft = createEpubImportDraft({
    packageTitle,
    spineChapters: chapters,
    originalFileName: fileName,
    notes,
  })
  const now = new Date().toISOString()
  return {
    id: stablePublicationId(fileName),
    title: draft.title.trim() || packageTitle || fileName.replace(/\.epub$/i, ''),
    sourceType: 'epub',
    chapters: draft.chapters.map((chapter, order) => ({ ...chapter, order })),
    createdAt: now,
    updatedAt: now,
    originalFileName: fileName,
    ...(draft.importNotes?.length ? { importNotes: draft.importNotes } : {}),
  }
}

function main(): void {
  const abs = join(FIXTURES_DIR, TINAD_FILE)
  if (!existsSync(abs)) {
    console.error(
      'Missing fixture:',
      TINAD_FILE,
      '— place it under e2e/fixtures/ or commit a pre-built public/reader/library-curated.json.',
    )
    process.exit(1)
  }
  const pub = publicationFromEpub(abs, TINAD_FILE)
  writeFileSync(OUT, stringifyPortableLibrary([pub]), 'utf8')
  console.log('Wrote', OUT, `(${TINAD_FILE}, id ${pub.id})`)
}

main()
