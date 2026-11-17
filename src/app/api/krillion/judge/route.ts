import { NextResponse } from 'next/server'
import { z } from 'zod'
import { krillionForDay, judgeAnswer } from '@/lib/daily/krillion'
import { DAILY_EPOCH, validDay } from '@/lib/daily'
const schema = z.object({ day:z.string().refine(d => validDay(d) && d >= DAILY_EPOCH && d <= '2100-12-31'), index:z.number().int().min(0).max(6), answer:z.string().max(100) })
const requests = new Map<string, { start: number; count: number }>()
export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({error:'Invalid answer'},{status:400})
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'
  const now = Date.now(), previous = requests.get(ip)
  const rate = previous && now-previous.start < 60000 ? previous : { start:now,count:0 }
  rate.count++; requests.set(ip,rate)
  if (requests.size > 10000) for (const [key,value] of requests) if (now-value.start>60000) requests.delete(key)
  if (rate.count > 30) return NextResponse.json({error:'Please wait a minute before checking more answers.'},{status:429})
  try {
    const puzzle = await krillionForDay(body.data.day)
    return NextResponse.json(await judgeAnswer(puzzle.prompts[body.data.index]!,body.data.answer))
  } catch (e) { return NextResponse.json({error:e instanceof Error ? e.message : 'Could not check answer'},{status:503}) }
}
