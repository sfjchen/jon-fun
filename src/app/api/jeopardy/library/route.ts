import { NextRequest, NextResponse } from 'next/server'
import { checkPasscode, listLibrary } from '@/lib/jeopardy-library'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const passcode = req.nextUrl.searchParams.get('passcode')
  if (!checkPasscode(passcode)) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 })
  }
  const items = await listLibrary()
  return NextResponse.json({ items })
}
