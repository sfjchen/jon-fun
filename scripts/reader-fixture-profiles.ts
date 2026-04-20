/**
 * Per-file expectations for `verify-reader-fixtures.ts`.
 * Tune ranges when publisher spine or PDF heuristics change intentionally.
 */

export type ReaderFixtureKind = 'pdf' | 'epub'

export type ReaderFixtureProfile = {
  /** Basename under e2e/fixtures */
  fileName: string
  kind: ReaderFixtureKind
  /** If true, missing file is OK (log SKIP). If false, missing = harness failure. */
  optional?: boolean
  description?: string

  expectExactChapters?: number
  expectMinChapters?: number
  expectMaxChapters?: number

  /** Package title (EPUB) or draft title contains these substrings */
  titleIncludes?: string[]

  /** At least one substring/regex must appear in full draft text */
  keywordAnywhere?: (string | RegExp)[]

  firstChapterTitle?: RegExp
  lastChapterTitle?: RegExp

  /** PDF: Book 1 floor (Meditations) */
  minFirstChapterWords?: number

  /** Draft total words (after format step) */
  minTotalWords?: number

  /** Raw extracted PDF text length before chapterize */
  minExtractedChars?: number

  /** If raw PDF text is shorter, skip strict chapter expectations (image-only PDF) */
  minExtractedCharsForStrictPdf?: number

  /**
   * Max allowed consecutive duplicate paragraph rate within any single chapter
   * (normalized whitespace); catches EPUB parent/child duplication bugs.
   */
  maxChapterConsecutiveDupRate?: number
}

export const READER_FIXTURE_PROFILES: ReaderFixtureProfile[] = [
  {
    fileName: 'minimal-reader-test.epub',
    kind: 'epub',
    description: 'Synthetic 2-chapter EPUB',
    expectExactChapters: 2,
    titleIncludes: ['Minimal Fixture'],
    keywordAnywhere: ['First paragraph of chapter one', 'Alpha content'],
    maxChapterConsecutiveDupRate: 0.05,
  },
  {
    fileName: 'meditations-a-new-translation-hardcover.pdf',
    kind: 'pdf',
    description: 'Meditations — Book 1…12 detection',
    optional: true,
    expectExactChapters: 12,
    firstChapterTitle: /book\s*1/i,
    lastChapterTitle: /^book\s*12\b/i,
    minFirstChapterWords: 3000,
    minExtractedChars: 200_000,
    maxChapterConsecutiveDupRate: 0.02,
  },
  {
    fileName: 'dokumen.pub_meditations-a-new-translation-hardcover.epub',
    kind: 'epub',
    description: 'Meditations EPUB — spine coalescing merges short Book N stubs + leading noise',
    optional: true,
    expectMinChapters: 14,
    expectMaxChapters: 40,
    titleIncludes: ['Meditations'],
    keywordAnywhere: [/Marcus/i],
    minTotalWords: 50_000,
    maxChapterConsecutiveDupRate: 0.04,
  },
  {
    fileName: '[Cradle 1 ] Wight, Will - Unsouled (2016, Hidden Gnome Publishing) - libgen.li.epub',
    kind: 'epub',
    description: 'Fiction EPUB — long spine, front matter then chapters',
    optional: true,
    expectMinChapters: 20,
    expectMaxChapters: 35,
    titleIncludes: ['Unsouled'],
    keywordAnywhere: [/Chapter\s+1\b/i, /Cradle/i],
    minTotalWords: 80_000,
    maxChapterConsecutiveDupRate: 0.04,
  },
  {
    fileName: 'RedBook copy.pdf',
    kind: 'pdf',
    description: 'Large PDF — require substantial text layer; chapter count is heuristic',
    optional: true,
    minExtractedChars: 100_000,
    minExtractedCharsForStrictPdf: 100_000,
    expectMinChapters: 1,
    expectMaxChapters: 15,
    minTotalWords: 100_000,
    maxChapterConsecutiveDupRate: 0.03,
  },
  {
    fileName: 'The Name of the Wind (Rothfuss Patrick) (z-library.sk, 1lib.sk, z-lib.sk).epub',
    kind: 'epub',
    description: 'Long fantasy EPUB — many spine sections',
    optional: true,
    expectMinChapters: 80,
    expectMaxChapters: 120,
    titleIncludes: ['Name of the Wind'],
    keywordAnywhere: [/Kvothe/i, /Rothfuss/i],
    minTotalWords: 240_000,
    maxChapterConsecutiveDupRate: 0.04,
  },
  {
    fileName: 'There Is No Antimemetics Division (qntm) (z-library.sk, 1lib.sk, z-lib.sk).epub',
    kind: 'epub',
    description: 'Kobo-style XHTML (self-closing script) — must parse full body text',
    optional: true,
    expectMinChapters: 15,
    expectMaxChapters: 35,
    titleIncludes: ['Antimemetics'],
    keywordAnywhere: [/Quinn/i, /Organisation/i],
    minTotalWords: 60_000,
    maxChapterConsecutiveDupRate: 0.04,
  },
]
