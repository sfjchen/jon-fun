/**
 * Matrix: every profiled file under e2e/fixtures → extract → chapterize / EPUB draft → assertions + metrics.
 * Run: npm run verify:reader-fixtures
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { extractEpubFromBuffer } from '../src/lib/reader/epub-extract-server'
import { extractPdfTextFromBuffer } from '../src/lib/reader/pdf-extract-server'
import { createEpubImportDraft, createImportDraft, splitChapterAtMidpoint } from '../src/lib/reader/text-chapters'
import type { ReaderChapter, ReaderImportDraft } from '../src/lib/reader/types'
import { READER_FIXTURE_PROFILES, type ReaderFixtureProfile } from './reader-fixture-profiles'

const FIXTURES_DIR = join(process.cwd(), 'e2e/fixtures')

function consecutiveDupRate(paragraphs: string[]): number {
  if (paragraphs.length < 2) return 0
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  let d = 0
  for (let i = 1; i < paragraphs.length; i++) {
    if (norm(paragraphs[i]!) === norm(paragraphs[i - 1]!)) d++
  }
  return d / (paragraphs.length - 1)
}

function maxChapterDupRate(draft: ReaderImportDraft): number {
  let max = 0
  for (const ch of draft.chapters) {
    max = Math.max(max, consecutiveDupRate(ch.paragraphs))
  }
  return max
}

function fullText(draft: ReaderImportDraft): string {
  return draft.chapters.map((c: ReaderChapter) => c.paragraphs.join('\n')).join('\n')
}

function fail(profile: ReaderFixtureProfile, msg: string): void {
  console.error(`FAIL [${profile.fileName}]: ${msg}`)
}

function logMetrics(label: string, draft: ReaderImportDraft, extra: Record<string, string | number>): void {
  const words = draft.chapters.reduce((s: number, c: ReaderChapter) => s + c.wordCount, 0)
  const ch0 = draft.chapters[0]
  const p0 = ch0?.paragraphs ?? []
  const maxPara0 = p0.length ? Math.max(...p0.map((p) => p.length)) : 0
  console.log(
    `  ${label}: chapters=${draft.chapters.length} words=${words} maxDup=${maxChapterDupRate(draft).toFixed(4)} ch0_paras=${p0.length} ch0_maxParaChars=${maxPara0}`,
    extra,
  )
}

async function runProfile(profile: ReaderFixtureProfile): Promise<boolean> {
  const abs = join(FIXTURES_DIR, profile.fileName)
  if (!existsSync(abs)) {
    if (profile.optional) {
      console.log(`SKIP (missing) ${profile.fileName}`)
      return true
    }
    fail(profile, 'fixture required but missing')
    return false
  }

  let draft: ReaderImportDraft
  let extractedChars = 0

  try {
    const buf = readFileSync(abs)
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

    if (profile.kind === 'pdf') {
      const { text } = await extractPdfTextFromBuffer(ab)
      extractedChars = text.length
      draft = createImportDraft({
        rawText: text,
        sourceType: 'pdf',
        title: profile.fileName.replace(/\.pdf$/i, ''),
        originalFileName: profile.fileName,
      })
    } else {
      const { packageTitle, chapters, notes } = extractEpubFromBuffer(ab)
      draft = createEpubImportDraft({
        packageTitle,
        spineChapters: chapters,
        originalFileName: profile.fileName,
        notes,
      })
    }
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : String(caught)
    fail(profile, `extract/draft: ${msg}`)
    return false
  }

  const text = fullText(draft)
  const words = draft.chapters.reduce((s: number, c: ReaderChapter) => s + c.wordCount, 0)
  const dup = maxChapterDupRate(draft)
  logMetrics('metrics', draft, { extractedChars })

  const strictPdf =
    profile.kind !== 'pdf' ||
    !profile.minExtractedCharsForStrictPdf ||
    extractedChars >= profile.minExtractedCharsForStrictPdf

  if (profile.minExtractedChars != null && extractedChars < profile.minExtractedChars) {
    fail(profile, `extracted chars ${extractedChars} < ${profile.minExtractedChars}`)
    return false
  }

  if (strictPdf && profile.expectExactChapters != null && draft.chapters.length !== profile.expectExactChapters) {
    fail(profile, `expected ${profile.expectExactChapters} chapters, got ${draft.chapters.length}`)
    return false
  }
  if (strictPdf && profile.expectMinChapters != null && draft.chapters.length < profile.expectMinChapters) {
    fail(profile, `expected ≥${profile.expectMinChapters} chapters, got ${draft.chapters.length}`)
    return false
  }
  if (strictPdf && profile.expectMaxChapters != null && draft.chapters.length > profile.expectMaxChapters) {
    fail(profile, `expected ≤${profile.expectMaxChapters} chapters, got ${draft.chapters.length}`)
    return false
  }

  if (profile.titleIncludes?.length) {
    const t = `${draft.title}`.toLowerCase()
    for (const sub of profile.titleIncludes) {
      if (!t.includes(sub.toLowerCase())) {
        fail(profile, `title "${draft.title}" missing "${sub}"`)
        return false
      }
    }
  }

  if (profile.keywordAnywhere?.length) {
    for (const kw of profile.keywordAnywhere) {
      const ok = typeof kw === 'string' ? text.includes(kw) : kw.test(text)
      if (!ok) {
        fail(profile, `keyword not found: ${kw}`)
        return false
      }
    }
  }

  const first = draft.chapters[0]
  const last = draft.chapters[draft.chapters.length - 1]
  if (profile.firstChapterTitle && first && !profile.firstChapterTitle.test(first.title)) {
    fail(profile, `first chapter title: ${first.title}`)
    return false
  }
  if (profile.lastChapterTitle && last && !profile.lastChapterTitle.test(last.title.trim())) {
    fail(profile, `last chapter title: ${last.title}`)
    return false
  }

  if (profile.minFirstChapterWords != null && first && first.wordCount < profile.minFirstChapterWords) {
    fail(profile, `Book 1 words ${first.wordCount} < ${profile.minFirstChapterWords}`)
    return false
  }

  if (profile.minTotalWords != null && words < profile.minTotalWords) {
    fail(profile, `total words ${words} < ${profile.minTotalWords}`)
    return false
  }

  if (profile.maxChapterConsecutiveDupRate != null && dup > profile.maxChapterConsecutiveDupRate) {
    fail(profile, `max consecutive dup rate ${dup.toFixed(4)} > ${profile.maxChapterConsecutiveDupRate}`)
    return false
  }

  console.log(`OK ${profile.fileName}`)
  return true
}

async function main(): Promise<void> {
  const onDisk = new Set(
    existsSync(FIXTURES_DIR)
      ? readdirSync(FIXTURES_DIR).filter((f) => /\.(pdf|epub)$/i.test(f))
      : [],
  )
  const profileNames = new Set(READER_FIXTURE_PROFILES.map((p) => p.fileName))
  for (const f of onDisk) {
    if (!profileNames.has(f)) {
      console.warn(`WARN: fixture on disk but no profile: ${f} (add to reader-fixture-profiles.ts)`)
    }
  }

  let bad = false
  for (const profile of READER_FIXTURE_PROFILES) {
    const ok = await runProfile(profile)
    if (!ok) bad = true
  }

  const splitErr = await (async () => {
    const med = join(FIXTURES_DIR, 'meditations-a-new-translation-hardcover.pdf')
    if (!existsSync(med)) {
      console.log('SKIP split-midpoint check (no Meditations PDF)')
      return null
    }
    const buf = readFileSync(med)
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const { text } = await extractPdfTextFromBuffer(ab)
    const draft = createImportDraft({
      rawText: text,
      sourceType: 'pdf',
      title: 'Meditations',
      originalFileName: 'meditations.pdf',
    })
    const ch = draft.chapters[0]
    if (!ch || ch.paragraphs.length < 4) return 'split check: Book 1 too small'
    const after = splitChapterAtMidpoint(draft.chapters, ch.id)
    const a = after.find((c) => c.title.includes('(A)'))
    const b = after.find((c) => c.title.includes('(B)'))
    if (!a || !b) return 'split check: missing (A)/(B) chapters'
    const total = a.wordCount + b.wordCount
    const ratio = total > 0 ? a.wordCount / total : 0
    if (ratio < 0.38 || ratio > 0.62) {
      return `split check: word ratio ${ratio.toFixed(3)} not near 0.5 (A=${a.wordCount} B=${b.wordCount})`
    }
    return null
  })()

  if (splitErr) {
    console.error(`FAIL ${splitErr}`)
    bad = true
  } else {
    console.log('OK split-midpoint (Meditations Book 1 word-balanced)')
  }

  if (bad) {
    process.exit(1)
  }
  console.log('\nAll reader fixture checks passed.')
}

void main()
