/**
 * Writes public/reader/library-curated.json from the TINAD EPUB in e2e/fixtures/ (required) plus
 * optional extras (e.g. Witcher) when those files exist — same stable publication ids as
 * seed:reader-portable / sync:reader-communal-fixtures so merges dedupe.
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

/** Appended when present under e2e/fixtures/ (omit from repo/CI without breaking the build). */
const CURATED_OPTIONAL_EPUBS = [
  'Witcher 1 The Last Wish (Andrzej Sapkowski) (z-library.sk, 1lib.sk, z-lib.sk).epub',
] as const
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
  const tinadAbs = join(FIXTURES_DIR, TINAD_FILE)
  if (!existsSync(tinadAbs)) {
    console.error(
      'Missing fixture:',
      TINAD_FILE,
      '— place it under e2e/fixtures/ or commit a pre-built public/reader/library-curated.json.',
    )
    process.exit(1)
  }
  const pubs: ReaderPublication[] = [publicationFromEpub(tinadAbs, TINAD_FILE)]
  for (const name of CURATED_OPTIONAL_EPUBS) {
    const abs = join(FIXTURES_DIR, name)
    if (!existsSync(abs)) {
      console.warn('SKIP curated (missing optional fixture):', name)
      continue
    }
    pubs.push(publicationFromEpub(abs, name))
    console.log('Curated optional:', name)
  }
  writeFileSync(OUT, stringifyPortableLibrary(pubs), 'utf8')
  console.log('Wrote', OUT, `(${pubs.length} books)`)
}

main()
