import { NextResponse } from 'next/server'
import { z } from 'zod'
import { judgeAnswer } from '@/lib/daily/krillion'
import { rateLimited } from '@/lib/api-guards'
import { playableDay } from '@/lib/daily'
export const maxDuration = 60
const schema = z.object({
  day: z.string().refine((d) => playableDay('krillion', d)),
  index: z.number().int().min(0).max(6),
  answer: z.string().max(256),
  preview: z.boolean().optional(),
})
export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid answer' }, { status: 400 })
  if (rateLimited(req, 'krillion-judge', 30))
    return NextResponse.json({ error: 'Please wait a minute before checking more answers.' }, { status: 429 })
  try {
    return NextResponse.json(await judgeAnswer(body.data.day, body.data.index, body.data.answer, body.data.preview))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not check answer' }, { status: 503 })
  }
}
