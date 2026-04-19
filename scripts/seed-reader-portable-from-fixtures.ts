/**
 * Build a portable library JSON from DRM-free EPUBs in e2e/fixtures (local dev).
 * Open the e-reader → Import library (.json) on any device to load the same books.
 *
 * Usage: npx tsx scripts/seed-reader-portable-from-fixtures.ts [outPath]
 * Default out: ./reader-library-portable.json (gitignored)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { v5 as uuidv5 } from 'uuid'
import { extractEpubFromBuffer } from '../src/lib/reader/epub-extract-server'
import { createEpubImportDraft } from '../src/lib/reader/text-chapters'
import { stringifyPortableLibrary } from '../src/lib/reader/library-portable'
import type { ReaderPublication } from '../src/lib/reader/types'

/** Order = shelf order; stable UUID (Universally Unique Identifier) per file for idempotent catalog merges. */
const FIXTURE_NAMES = [
  'The Name of the Wind (Rothfuss Patrick) (z-library.sk, 1lib.sk, z-lib.sk).epub',
  'There Is No Antimemetics Division (qntm) (z-library.sk, 1lib.sk, z-lib.sk).epub',
  'dokumen.pub_meditations-a-new-translation-hardcover.epub',
  '[Cradle 1 ] Wight, Will - Unsouled (2016, Hidden Gnome Publishing) - libgen.li.epub',
]

const FIXTURES_DIR = join(process.cwd(), 'e2e/fixtures')
/** DNS namespace UUID for RFC 4122 v5 names. */
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
  const outPath = process.argv[2] ?? join(process.cwd(), 'reader-library-portable.json')
  const pubs: ReaderPublication[] = []
  for (const name of FIXTURE_NAMES) {
    const abs = join(FIXTURES_DIR, name)
    if (!existsSync(abs)) {
      console.warn('SKIP (missing):', name)
      continue
    }
    console.log('Adding:', name)
    pubs.push(publicationFromEpub(abs, name))
  }
  if (!pubs.length) {
    console.error('No fixtures found. Place the EPUBs under e2e/fixtures/.')
    process.exit(1)
  }
  writeFileSync(outPath, stringifyPortableLibrary(pubs), 'utf8')
  console.log('Wrote', outPath, `(${pubs.length} books)`)
}

main()
