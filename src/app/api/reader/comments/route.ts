import { NextRequest, NextResponse } from 'next/server'
import {
  commentsBackendReady,
  parseCommentPostBody,
  rowToDto,
  type ReaderPublicationCommentRow,
} from '@/lib/reader/comments-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  if (!commentsBackendReady()) {
    return NextResponse.json({ error: 'comments_unavailable' }, { status: 503 })
  }

  const publicationId = request.nextUrl.searchParams.get('publicationId')?.trim() ?? ''
  const chapterId = request.nextUrl.searchParams.get('chapterId')?.trim() ?? ''
  if (!publicationId || !chapterId) {
    return NextResponse.json({ error: 'publicationId and chapterId required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('reader_publication_comments')
    .select('*')
    .eq('publication_id', publicationId)
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as ReaderPublicationCommentRow[]
  return NextResponse.json({ comments: rows.map(rowToDto) })
}

export async function POST(request: NextRequest) {
  if (!commentsBackendReady()) {
    return NextResponse.json({ error: 'comments_unavailable' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseCommentPostBody(body)
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'Invalid comment'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('reader_publication_comments')
    .insert({
      publication_id: parsed.publicationId,
      chapter_id: parsed.chapterId,
      block_id: parsed.blockId,
      body: parsed.body,
      author_display: parsed.authorDisplay,
      author_fingerprint: parsed.authorFingerprint,
    })
    .select('*')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  return NextResponse.json({ comment: rowToDto(data as ReaderPublicationCommentRow) })
}
