import { readFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'
import path from 'node:path'
import { supabaseAdmin } from '@/lib/supabase'
import { siteDay, validDay } from '@/lib/daily'
import { answerKey, editDistance, KRILLION_TIERS, type KrillionReview, type KrillionPuzzle, type KrillionJudgment, type KrillionAnswer } from '@/lib/krillion'
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
  const miss={answer,accepted:false,score:0,reason:answer.trim()?'Not in this prompt’s accepted answer set.':'No answer before the clock ran out.'}
  const key=answerKey(answer)
  if(!key)return miss
  let lookup=indices.get(prompt)
  if(!lookup){lookup=new Map();for(const entry of prompt.answers)for(const alias of [entry.answer,...entry.aliases??[]]){const normalized=answerKey(alias);if(normalized&&!lookup.has(normalized))lookup.set(normalized,entry)}indices.set(prompt,lookup)}
  let matched=lookup.get(key)
  if(!matched&&key.length>=4){
    const max=key.length<8?1:2
    let distance=max+1,ambiguous=false
    for(const [alias,entry] of lookup){if(Math.abs(alias.length-key.length)>max)continue;const d=editDistance(key,alias,max);if(d<distance){distance=d;matched=entry;ambiguous=false}else if(d===distance&&matched?.answer!==entry.answer)ambiguous=true}
    if(ambiguous||distance>max)matched=undefined
  }
  if(matched)return {answer,accepted:true,score:matched.score,tier:matched.tier,matchedAnswer:matched.answer,...(matched.quip?{quip:matched.quip}:{}),reason:`${KRILLION_TIERS[matched.tier].name} · ${matched.score} points`}
  return miss
}
