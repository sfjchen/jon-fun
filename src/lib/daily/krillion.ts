import { readFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import path from 'node:path'
import { supabaseAdmin } from '@/lib/supabase'
import { siteDay, validDay } from '@/lib/daily'
import { answerLookup, judgeWith, KRILLION_TIERS, type KrillionReview, type KrillionPuzzle, type KrillionJudgment, type KrillionAnswer } from '@/lib/krillion'
const cache=new Map<string,Promise<KrillionReview>>()
function checked(value: unknown, date: string): KrillionReview {
  const r=value as KrillionReview
  if(r?.date!==date||r.prompts?.length!==7||r.prompts.some(p=>typeof p.id!=='string'||typeof p.text!=='string'||!Array.isArray(p.answers)||!p.answers.length||p.answers.some(a=>typeof a.answer!=='string'||!a.answer.trim()||!Object.hasOwn(KRILLION_TIERS,a.tier)||a.score!==KRILLION_TIERS[a.tier].score||a.aliases?.some(s=>typeof s!=='string')))) throw Error('The original answer review is incomplete')
  return r
}
async function downloadReview(date:string):Promise<KrillionReview> {
  const r=await fetch(`https://krillion.io/api/reveal?date=${date}`,{signal:AbortSignal.timeout(20000),cache:'no-store'})
  if(!r.ok)throw Error('The original answer review is not available for this date. Choose a published day.')
  return checked(await r.json(),date)
}
async function storeReview(review:KrillionReview) {
  const payload={gzipBase64:gzipSync(Buffer.from(JSON.stringify(review))).toString('base64'),format:'krillion-review-v1'}
  const result=await supabaseAdmin.from('daily_game_content').upsert({game:'krillion-review',source_day:review.date,payload})
  if(result.error)throw Error('Could not store the original answer review')
}
async function loadReview(date:string):Promise<KrillionReview> {
  try{return checked(JSON.parse(gunzipSync(await readFile(path.join(process.cwd(),'data/krillion/review',`${date}.json.gz`))).toString()),date)}catch{}
  const stored=await supabaseAdmin.from('daily_game_content').select('payload').eq('game','krillion-review').eq('source_day',date).maybeSingle()
  if(stored.data?.payload?.gzipBase64) return checked(JSON.parse(gunzipSync(Buffer.from(stored.data.payload.gzipBase64,'base64')).toString()),date)
  if(date>siteDay())throw Error('This Krillion dive has not been published yet. Choose today or a past day.')
  const review=await downloadReview(date)
  await storeReview(review)
  return review
}
export function krillionReview(date:string):Promise<KrillionReview> {
  if(!validDay(date))return Promise.reject(Error('Invalid date'))
  let pending=cache.get(date)
  if(!pending){pending=loadReview(date).catch(e=>{cache.delete(date);throw e});cache.set(date,pending);if(cache.size>3)cache.delete(cache.keys().next().value!)}
  return pending
}
export async function captureKrillion():Promise<{date:string;prompts:{id:string;text:string}[];officialScoring:true}> {
  const r=await fetch('https://krillion.io/api/today',{signal:AbortSignal.timeout(10000),cache:'no-store'})
  if(!r.ok)throw Error('Could not capture public daily prompts')
  const data=await r.json() as {date:string;prompts:{id:string;text:string}[]}
  if(!validDay(data.date)||data.prompts?.length!==7)throw Error('Invalid daily prompts')
  const review=await downloadReview(data.date)
  await storeReview(review)
  cache.set(data.date,Promise.resolve(review))
  return {date:data.date,prompts:review.prompts.map(({id,text})=>({id,text})),officialScoring:true}
}
export async function krillionForDay(day:string):Promise<KrillionPuzzle> {
  const review=await krillionReview(day)
  return {date:review.date,prompts:review.prompts.map(({id,text})=>({id,text})),answerMs:25000,officialScoring:true}
}
const indices=new WeakMap<object,Map<string,KrillionAnswer>>()
export async function judgeAnswer(date:string,index:number,answer:string):Promise<KrillionJudgment> {
  const prompt=(await krillionReview(date)).prompts[index]
  if(!prompt)throw Error('Invalid prompt')
  let lookup=indices.get(prompt)
  if(!lookup){lookup=answerLookup(prompt.answers);indices.set(prompt,lookup)}
  return judgeWith(lookup,answer)
}
export type KrillionPercentile={betterThan:number;dist:number[];sample?:number;live:boolean}
/**
 * Places a score in the original game's player distribution: 20 bins of 35 points across 0-700. While the
 * original still has the date open it answers live without recording a play, and each answer is saved, so a
 * closed day falls back to its last saved curve with the percentile read from the bins.
 */
export async function krillionPercentile(date:string,score:number):Promise<KrillionPercentile|null>{
  try{
    const r=await fetch('https://krillion.io/api/today/complete',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(5000),cache:'no-store',
      body:JSON.stringify({date,playerId:crypto.randomUUID(),score,record:false})})
    const live=await r.json() as {betterThan?:number;dist?:number[];sample?:number}
    if(r.ok&&typeof live.betterThan==='number'&&Array.isArray(live.dist)&&live.dist.length===20){
      await supabaseAdmin.from('daily_game_content').upsert({game:'krillion-dist',source_day:date,payload:{dist:live.dist,sample:live.sample,at:new Date().toISOString()}})
      return {betterThan:live.betterThan,dist:live.dist,...(live.sample?{sample:live.sample}:{}),live:true}
    }
  }catch{}
  const stored=await supabaseAdmin.from('daily_game_content').select('payload').eq('game','krillion-dist').eq('source_day',date).maybeSingle()
  const dist=stored.data?.payload?.dist as number[]|undefined
  if(!Array.isArray(dist)||dist.length!==20)return null
  const total=dist.reduce((a,b)=>a+b,0),bin=Math.min(19,Math.floor(score/35))
  if(!total)return null
  const below=dist.slice(0,bin).reduce((a,b)=>a+b,0)+dist[bin]!*((score-bin*35)/35)
  return {betterThan:Math.round(below/total*100),dist,sample:stored.data?.payload?.sample,live:false}
}
/** Saves the final curve of the date the original still has open, just before it closes for the day. */
export async function captureKrillionDist():Promise<string>{
  const r=await fetch('https://krillion.io/api/today',{signal:AbortSignal.timeout(10000),cache:'no-store'})
  const {date}=await r.json() as {date:string}
  if(!validDay(date)||!(await krillionPercentile(date,0))?.live)throw Error('Could not capture the score curve')
  return date
}
