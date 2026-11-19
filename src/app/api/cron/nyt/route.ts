import { NextResponse } from 'next/server'
import { captureNytDaily } from '@/lib/daily/nyt'
export const maxDuration = 60
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const results = await captureNytDaily()
  return NextResponse.json({ ok: results.every(r => r.status === 'fulfilled'), captured: results.filter(r => r.status === 'fulfilled').length }, { status: results.every(r => r.status === 'fulfilled') ? 200 : 503 })
}
