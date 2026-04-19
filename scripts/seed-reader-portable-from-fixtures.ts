/**
 * Build a portable library JSON from DRM-free EPUBs in e2e/fixtures (local dev).
 * Open the e-reader → Import library (.json) on any device to load the same books.
 *
 * Usage: npx tsx scripts/seed-reader-portable-from-fixtures.ts [outPath]
 * Default out: ./reader-library-portable.json (gitignored)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { extractEpubFromBuffer } from '../src/lib/reader/epub-extract-server'
import { createEpubImportDraft } from '../src/lib/reader/text-chapters'
import { stringifyPortableLibrary } from '../src/lib/reader/library-portable'
import type { ReaderPublication } from '../src/lib/reader/types'

const FIXTURE_NAMES = [
  'The Name of the Wind (Rothfuss Patrick) (z-library.sk, 1lib.sk, z-lib.sk).epub',
  'There Is No Antimemetics Division (qntm) (z-library.sk, 1lib.sk, z-lib.sk).epub',
]

const FIXTURES_DIR = join(process.cwd(), 'e2e/fixtures')

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
    id: uuidv4(),
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
