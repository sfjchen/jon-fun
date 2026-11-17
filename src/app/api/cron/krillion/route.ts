import { NextResponse } from 'next/server'
import { captureKrillion } from '@/lib/daily/krillion'
export const maxDuration=60
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({error:'Unauthorized'},{status:401})
  try { const puzzle = await captureKrillion(); return NextResponse.json({ok:true,sourceDate:puzzle.date,prompts:puzzle.prompts.length}) }
  catch { return NextResponse.json({error:'Krillion capture failed'},{status:503}) }
}
