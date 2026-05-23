import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { slugify } from '@/lib/jeopardy'
import { checkPasscode, readLibraryBoard } from '@/lib/jeopardy-library'

export const dynamic = 'force-dynamic'

function generateSlug(title: string): string {
  const base = slugify(title || 'board') || 'board'
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  const body = (await req.json().catch(() => ({}))) as { passcode?: string; editorName?: string }
  if (!checkPasscode(body.passcode)) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 })
  }
  const board = await readLibraryBoard(filename)
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const editor = (body.editorName || '').trim().slice(0, 40)
  const id = uuidv4()
  const title = (board.title || filename).slice(0, 120)
  const now = new Date().toISOString()

  let finalSlug: string | null = null
  for (let attempt = 0; attempt < 6 && !finalSlug; attempt++) {
    const slug = generateSlug(title)
    const { error } = await supabase.from('jeopardy_boards').insert({
      id,
      slug,
      title,
      board: { ...board, id, title },
      base_value: board.baseValue,
      increment: board.increment,
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
    if (!code.includes('23505') && !error.message?.includes('duplicate')) {
      return NextResponse.json({ error: 'Failed to import board' }, { status: 500 })
    }
  }
  if (!finalSlug) return NextResponse.json({ error: 'Could not allocate slug' }, { status: 500 })
  return NextResponse.json({ slug: finalSlug, title })
}
