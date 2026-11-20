import { NextResponse } from 'next/server'
import { krillionReview } from '@/lib/daily/krillion'
import { validDay, siteDay, DAILY_EPOCH } from '@/lib/daily'
import { KRILLION_TIERS, type KrillionTier } from '@/lib/krillion'
export const maxDuration=60
export async function GET(req:Request){
  const q=new URL(req.url).searchParams, day=q.get('d')??siteDay(), index=Number(q.get('prompt')??0)
  if(!validDay(day)||day<DAILY_EPOCH||!Number.isInteger(index)||index<0||index>6)return NextResponse.json({error:'Invalid date or prompt'},{status:400})
  try{
    const prompt=(await krillionReview(day)).prompts[index]!
    // The game fetches each prompt's whole answer key ahead of time to judge answers on the device.
    if(q.get('all')==='1')return NextResponse.json({answers:prompt.answers},{headers:{'Cache-Control':'public, max-age=86400, s-maxage=604800'}})
    const search=(q.get('q')??'').trim().toLowerCase().slice(0,100),tier=q.get('tier')
    const all=prompt.answers.filter(a=>(!tier||tier==='all'||a.tier===tier)&&(!search||[a.answer,...a.aliases??[]].some(s=>s.toLowerCase().includes(search))))
    const page=Math.max(0,Math.min(5000,Number(q.get('page'))||0)),size=50
    return NextResponse.json({date:day,prompt:{id:prompt.id,text:prompt.text},total:all.length,page,pageSize:size,tiers:Object.fromEntries((Object.keys(KRILLION_TIERS) as KrillionTier[]).map(t=>[t,prompt.answers.filter(a=>a.tier===t).length])),answers:all.slice(page*size,(page+1)*size)},{headers:{'Cache-Control':'private, max-age=300'}})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Answer review unavailable'},{status:503})}
}
