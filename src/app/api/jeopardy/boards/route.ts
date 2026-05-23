import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { createDefaultBoard, slugify, type JeopardyBoard } from '@/lib/jeopardy'
import { normalizeBoard } from '@/lib/jeopardy-ops'

function generateSlug(title: string): string {
  const base = slugify(title || 'board') || 'board'
  const rand = Math.random().toString(36).slice(2, 7) // 5 chars
  return `${base}-${rand}`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string
      board?: unknown
      editorName?: string
    }
    const editor = (body.editorName || '').trim().slice(0, 40)
    const initial: JeopardyBoard = body.board
      ? normalizeBoard(body.board, uuidv4())
      : createDefaultBoard(body.title?.trim() || 'Title')

    const title = (body.title?.trim() || initial.title || 'Untitled').slice(0, 120)
    const id = uuidv4()
    const now = new Date().toISOString()

    let finalSlug: string | null = null
    for (let attempt = 0; attempt < 6 && !finalSlug; attempt++) {
      const slug = generateSlug(title)
      const { error } = await supabase.from('jeopardy_boards').insert({
        id,
        slug,
        title,
        board: { ...initial, id, title },
        base_value: initial.baseValue,
        increment: initial.increment,
        version: 0,
        last_editor: editor,
        created_at: now,
        updated_at: now,
      })
      if (!error) {
        finalSlug = slug
        break
      }
      const code = error.code?.toString() || ''
      const msg = error.message || ''
      if (!code.includes('23505') && !msg.includes('duplicate')) {
        return NextResponse.json({ error: 'Failed to create board' }, { status: 500 })
      }
    }
    if (!finalSlug) return NextResponse.json({ error: 'Could not allocate slug' }, { status: 500 })

    const { data: row } = await supabase
      .from('jeopardy_boards')
      .select('slug, title, board, version, updated_at, last_editor')
      .eq('slug', finalSlug)
      .single()

    return NextResponse.json({
      slug: finalSlug,
      board: row?.board ?? { ...initial, id, title },
      version: row?.version ?? 0,
      updatedAt: row?.updated_at ?? now,
      lastEditor: row?.last_editor ?? editor,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
