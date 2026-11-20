import type {
  ReaderChapter,
  ReaderIngestMeta,
  ReaderProgress,
  ReaderPublication,
  ReaderPublicationSummary,
  ReaderSourceType,
} from '@/lib/reader/types'

const SOURCE_TYPES: ReaderSourceType[] = ['txt', 'paste', 'pdf', 'epub']

export function communalReaderBackendReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return Boolean(key && url && !url.includes('placeholder.supabase.co'))
}

/** Max JSON body size for one publication (bytes, UTF-8 length proxy). */
export const READER_COMMUNAL_MAX_BODY_CHARS = 8_000_000

export function publicationPayloadTooLarge(json: string): boolean {
  return json.length > READER_COMMUNAL_MAX_BODY_CHARS
}

function isSourceType(v: unknown): v is ReaderSourceType {
  return typeof v === 'string' && (SOURCE_TYPES as string[]).includes(v)
}

function isChapter(v: unknown): v is ReaderChapter {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  const base =
    typeof c.id === 'string' &&
    typeof c.order === 'number' &&
    typeof c.title === 'string' &&
    Array.isArray(c.paragraphs) &&
    c.paragraphs.every((p) => typeof p === 'string') &&
    typeof c.wordCount === 'number'
  if (!base) return false
  const paras = c.paragraphs as string[]
  if (c.blocks !== undefined) {
    if (!Array.isArray(c.blocks) || c.blocks.length !== paras.length) return false
    for (const [index, b] of c.blocks.entries()) {
      if (!b || typeof b !== 'object') return false
      const bk = b as Record<string, unknown>
      if (typeof bk.id !== 'string' || bk.text !== paras[index]) return false
      if (
        bk.kind !== undefined &&
        !['paragraph', 'heading', 'image', 'preformatted', 'quote'].includes(String(bk.kind))
      )
        return false
      if (bk.anchorId !== undefined && (typeof bk.anchorId !== 'string' || !/^[\w-]+$/.test(bk.anchorId))) return false
      if (bk.level !== undefined && (!Number.isInteger(bk.level) || Number(bk.level) < 1 || Number(bk.level) > 6))
        return false
      if (bk.runs !== undefined) {
        if (!Array.isArray(bk.runs)) return false
        for (const run of bk.runs) {
          if (!run || typeof run !== 'object' || typeof run.text !== 'string') return false
          for (const flag of ['italic', 'bold', 'superscript', 'subscript']) {
            if (run[flag] !== undefined && typeof run[flag] !== 'boolean') return false
          }
          if (run.href !== undefined && typeof run.href !== 'string') return false
          if (run.anchorId !== undefined && (typeof run.anchorId !== 'string' || !/^[\w-]+$/.test(run.anchorId)))
            return false
        }
        if (bk.runs.map((run) => run.text).join('') !== bk.text) return false
      }
      if (bk.image !== undefined) {
        if (!bk.image || typeof bk.image !== 'object') return false
        const image = bk.image as Record<string, unknown>
        if (typeof image.src !== 'string' || typeof image.alt !== 'string') return false
        if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(image.src)) return false
      }
      if (bk.kind === 'image' && !bk.image) return false
    }
  }
  return true
}

/** Validate and return publication, or throw with a short message. */
export function parseCommunalPublicationBody(body: unknown): ReaderPublication {
  if (!body || typeof body !== 'object') throw new Error('Invalid body')
  const p = body as Record<string, unknown>
  if (typeof p.id !== 'string' || !p.id.trim()) throw new Error('id required')
  if (typeof p.title !== 'string') throw new Error('title required')
  if (!isSourceType(p.sourceType)) throw new Error('sourceType invalid')
  if (!Array.isArray(p.chapters) || p.chapters.length === 0) throw new Error('chapters required')
  if (!p.chapters.every(isChapter)) throw new Error('chapter shape invalid')
  if (typeof p.createdAt !== 'string' || typeof p.updatedAt !== 'string') throw new Error('timestamps required')

  const pub: ReaderPublication = {
    id: p.id,
    title: p.title,
    sourceType: p.sourceType,
    chapters: p.chapters as ReaderChapter[],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
  if (typeof p.originalFileName === 'string' && p.originalFileName !== '') {
    pub.originalFileName = p.originalFileName
  }
  if (Array.isArray(p.importNotes) && p.importNotes.every((n) => typeof n === 'string')) {
    pub.importNotes = p.importNotes as string[]
  }
  if (p.ingestMeta && typeof p.ingestMeta === 'object') {
    const im = p.ingestMeta as Record<string, unknown>
    const flags = Array.isArray(im.flags) ? im.flags.filter((x) => typeof x === 'string') : undefined
    const oc = im.overallConfidence
    pub.ingestMeta = {
      ...(typeof oc === 'number' ? { overallConfidence: oc } : {}),
      ...(flags?.length ? { flags: flags as string[] } : {}),
    } as ReaderIngestMeta
  }
  return pub
}

export function parseReadingStatePatch(body: unknown): ReaderProgress {
  if (!body || typeof body !== 'object') throw new Error('Invalid body')
  const p = body as Record<string, unknown>
  if (typeof p.chapterId !== 'string' || typeof p.scrollY !== 'number' || typeof p.savedAt !== 'string') {
    throw new Error('chapterId, scrollY, savedAt required')
  }
  const out: ReaderProgress = {
    chapterId: p.chapterId,
    scrollY: p.scrollY,
    savedAt: p.savedAt,
    schemaVersion: 2,
  }
  if (typeof p.blockId === 'string') {
    out.blockId = p.blockId
    out.charOffset = typeof p.charOffset === 'number' ? p.charOffset : 0
  }
  return out
}

export type CommunalDbRow = {
  id: string
  title: string
  source_type: string
  chapters: ReaderChapter[]
  chapter_count: number
  total_words: number
  first_chapter_id: string
  original_file_name: string | null
  import_notes: string[] | null
  created_at: string
  updated_at: string
  reading_state?: ReaderProgress | null
  ingest_meta?: ReaderIngestMeta | null
}

export function publicationToDbRow(pub: ReaderPublication): Omit<
  CommunalDbRow,
  'chapter_count' | 'total_words' | 'first_chapter_id'
> & {
  chapter_count: number
  total_words: number
  first_chapter_id: string
} {
  const totalWords = pub.chapters.reduce((s, c) => s + c.wordCount, 0)
  return {
    id: pub.id,
    title: pub.title,
    source_type: pub.sourceType,
    chapters: pub.chapters,
    chapter_count: pub.chapters.length,
    total_words: totalWords,
    first_chapter_id: pub.chapters[0]?.id ?? '',
    original_file_name: pub.originalFileName ?? null,
    import_notes: pub.importNotes?.length ? pub.importNotes : null,
    created_at: pub.createdAt,
    updated_at: pub.updatedAt,
    ingest_meta: pub.ingestMeta ?? null,
  }
}

export function dbRowToPublication(row: CommunalDbRow): ReaderPublication {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type as ReaderSourceType,
    chapters: row.chapters,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.original_file_name ? { originalFileName: row.original_file_name } : {}),
    ...(row.import_notes?.length ? { importNotes: row.import_notes } : {}),
    ...(row.ingest_meta && typeof row.ingest_meta === 'object' ? { ingestMeta: row.ingest_meta } : {}),
  }
}

export function dbRowToSummary(
  row: Pick<
    CommunalDbRow,
    'id' | 'title' | 'source_type' | 'chapter_count' | 'total_words' | 'updated_at' | 'first_chapter_id'
  >,
): ReaderPublicationSummary {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type as ReaderSourceType,
    chapterCount: row.chapter_count,
    totalWords: row.total_words,
    updatedAt: row.updated_at,
    firstChapterId: row.first_chapter_id ?? '',
  }
}
