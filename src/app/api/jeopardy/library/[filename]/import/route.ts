import { NextRequest, NextResponse } from 'next/server'
import { checkPasscode, readLibraryBoard } from '@/lib/jeopardy-library'
import { insertNewBoard } from '@/lib/jeopardy-board-server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  const body = (await req.json().catch(() => ({}))) as { passcode?: string; editorName?: string }
  if (!checkPasscode(body.passcode)) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 })
  }
  const board = await readLibraryBoard(filename)
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await insertNewBoard({
    board,
    rawTitle: board.title || filename,
    editorName: body.editorName,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ slug: result.slug, title: result.title })
}
