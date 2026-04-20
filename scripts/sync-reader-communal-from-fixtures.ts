/**
 * Re-build the four seed EPUBs from e2e/fixtures and upsert into reader_communal_publications
 * (same stable UUID (Universally Unique Identifier) v5 ids as seed:reader-portable).
 * Deletes titles matching Arcanum Unbounded; removes stale rows per fixture file when
 * original_file_name matches but id differs.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (not placeholder URL).
 *
 * Usage: npx tsx scripts/sync-reader-communal-from-fixtures.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { v5 as uuidv5 } from 'uuid'
import { extractEpubFromBuffer } from '../src/lib/reader/epub-extract-server'
import { communalReaderBackendReady, publicationToDbRow } from '../src/lib/reader/communal-server'
import { createEpubImportDraft } from '../src/lib/reader/text-chapters'
import type { ReaderPublication } from '../src/lib/reader/types'

function loadEnvLocal(): void {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}

loadEnvLocal()

const FIXTURE_NAMES = [
  'The Name of the Wind (Rothfuss Patrick) (z-library.sk, 1lib.sk, z-lib.sk).epub',
  'There Is No Antimemetics Division (qntm) (z-library.sk, 1lib.sk, z-lib.sk).epub',
  'dokumen.pub_meditations-a-new-translation-hardcover.epub',
  '[Cradle 1 ] Wight, Will - Unsouled (2016, Hidden Gnome Publishing) - libgen.li.epub',
] as const

const FIXTURES_DIR = join(process.cwd(), 'e2e/fixtures')
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

async function main(): Promise<void> {
  if (!communalReaderBackendReady()) {
    console.error(
      'Communal backend not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (non-placeholder).',
    )
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { error: delArc } = await admin
    .from('reader_communal_publications')
    .delete()
    .ilike('title', '%Arcanum Unbounded%')
  if (delArc) {
    console.error('Delete Arcanum Unbounded:', delArc.message)
    process.exit(1)
  }
  console.log('Removed rows with title matching Arcanum Unbounded (if any).')

  const pubs: ReaderPublication[] = []
  for (const name of FIXTURE_NAMES) {
    const abs = join(FIXTURES_DIR, name)
    if (!existsSync(abs)) {
      console.warn('SKIP (missing fixture):', name)
      continue
    }
    const pub = publicationFromEpub(abs, name)
    pubs.push(pub)

    const { data: stale } = await admin
      .from('reader_communal_publications')
      .select('id')
      .eq('original_file_name', name)
      .neq('id', pub.id)

    const staleIds = (stale ?? []).map((r) => r.id as string)
    for (const sid of staleIds) {
      const { error: dErr } = await admin.from('reader_communal_publications').delete().eq('id', sid)
      if (dErr) console.warn('Stale row delete failed', sid, dErr.message)
      else console.log('Removed stale duplicate id', sid, 'for', name)
    }
  }

  if (!pubs.length) {
    console.error('No fixture EPUBs found under e2e/fixtures/.')
    process.exit(1)
  }

  for (const pub of pubs) {
    const row = publicationToDbRow(pub)
    const { error } = await admin.from('reader_communal_publications').upsert(row, { onConflict: 'id' })
    if (error) {
      console.error('Upsert failed', pub.title, error.message)
      process.exit(1)
    }
    console.log('Upserted:', pub.title, `(${pub.chapters.length} ch, ${row.total_words} words)`)
  }

  console.log('Done. Refresh the e-reader library in the browser.')
}

void main()

export {}
