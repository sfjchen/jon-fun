import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GAMES, GAME_IDS, scoringVersion, type GameId } from '@/lib/results'
import { DAILY_EPOCH, siteDay, validDay } from '@/lib/daily'
import { isNytGame, NYT_FIRST_DAY } from '@/lib/daily/nyt-puzzles'
import { supabaseAdmin } from '@/lib/supabase'
import { dailyPuzzle } from '@/lib/daily/server'
import { replayFivefold } from '@/lib/daily/fivefold'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
let fivefoldWords:Promise<Set<string>>|null=null
const group=z.string().regex(/^[a-z0-9-]{3,32}$/)
const stats=z.object({n:z.number().int().min(0).max(500).optional(),seconds:z.number().int().min(0).max(864000).optional(),mistakes:z.number().int().min(0).max(100).optional(),solved:z.boolean().optional(),max:z.number().int().min(1).max(100000).optional(),sourceDate:z.string().refine(validDay).optional(),puzzleId:z.string().max(100).optional(),scoringVersion:z.number().int().min(1).max(2).optional(),hard:z.boolean().optional(),guesses:z.array(z.string().regex(/^[a-z]{5}$/)).max(6).optional()})
const schema=z.object({group,name:z.string().trim().min(1).max(24),deviceId:z.string().uuid().optional(),today:z.string().refine(validDay),game:z.enum(GAME_IDS as [GameId,...GameId[]]),score:z.number().int().min(0),n:z.number().int().min(0).max(500).optional(),stats:stats.optional()})
export async function POST(req:Request){
  const parsed=schema.safeParse(await req.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:'Invalid result'},{status:400})
  const b=parsed.data
  let version=b.stats?.scoringVersion??1,score=b.score
  if(b.game==='mini'){
    if(b.stats?.seconds===undefined)return NextResponse.json({error:'Mini needs a completed solve time'},{status:400})
    score=b.stats.seconds;version=2
  }
  // Wordle scores are recomputed from the guesses against the day's answer, so a hand-made score cannot be posted.
  // The guesses are checked, then dropped, since stored guesses would reveal the answer to anyone reading scores.
  if(b.game==='fivefold'){
    const {guesses,...rest}=b.stats??{}
    if(!guesses)return NextResponse.json({error:'Wordle results need their guesses'},{status:400})
    try{
      fivefoldWords??=readFile(path.join(process.cwd(),'public/fivefold/words.json'),'utf8').then(t=>new Set(JSON.parse(t) as string[])).catch(e=>{fivefoldWords=null;throw e})
      const [{puzzle},words]=await Promise.all([dailyPuzzle('fivefold',b.today),fivefoldWords])
      const game=replayFivefold(guesses,(puzzle as {answer:string}).answer,w=>words.has(w),!!rest.hard)
      if('error' in game)return NextResponse.json({error:game.error},{status:400})
      score=game.score;version=2;b.stats={...rest,n:game.n,solved:game.solved,scoringVersion:2};delete b.n
    }catch{return NextResponse.json({error:'Could not check this Wordle result. It remains queued on your device.'},{status:503})}
  }
  if(b.game==='connections'&&b.stats?.n!==undefined&&b.stats.mistakes!==undefined){score=b.stats.n;version=2}
  const maximum=version===1&&b.game==='connections'?100:version===1&&b.game==='krillion'?7000:version===1&&b.game==='anthropeum'?10000:GAMES[b.game].max
  if(score>maximum||b.today<(isNytGame(b.game)?NYT_FIRST_DAY[b.game]:DAILY_EPOCH)||b.today>siteDay())return NextResponse.json({error:'Score or date out of range'},{status:400})
  if(isNytGame(b.game)&&b.stats?.sourceDate&&b.stats.sourceDate!==b.today)return NextResponse.json({error:'Puzzle source date does not match the result date'},{status:400})
  const key={group_code:b.group,name:b.name,game:b.game,day:b.today,scoring_version:version}
  const value={...key,score,...(b.deviceId?{device_id:b.deviceId}:{}),stats:{...b.stats,scoringVersion:version,...(b.n===undefined?{}:{n:b.n})}}
  const inserted=await supabaseAdmin.from('game_results').insert(value)
  if(inserted.error&&inserted.error.code!=='23505')return NextResponse.json({error:'Could not save score. It remains queued on your device.'},{status:503})
  if(inserted.error?.code==='23505'&&b.game==='bee'){
    const update=await supabaseAdmin.from('game_results').update({score,stats:value.stats}).match(key).lt('score',score)
    if(update.error)return NextResponse.json({error:'Could not sync score'},{status:503})

  }
  // Every game's first finished result is immutable, so clearing a board or browser data cannot replace it. Spelling
  // Bee only grows, since its score rises as more words are found the same day.
  return NextResponse.json({ok:true})
}
export async function GET(req:Request){
  const q=new URL(req.url).searchParams,g=group.safeParse(q.get('group'))
  if(!g.success)return NextResponse.json({error:'Invalid group'},{status:400})
  const days=Math.min(6000,Math.max(1,Number(q.get('days'))||400)),since=new Date(Date.now()-(days+1)*86400000).toISOString().slice(0,10)
  type Row={name:string;game:GameId;day:string;score:number;stats:Record<string,unknown>;scoring_version:number}
  const all:Row[]=[]
  for(let offset=0;offset<100000;offset+=1000){
    const {data,error}=await supabaseAdmin.from('game_results').select('name,game,day,score,stats,scoring_version').eq('group_code',g.data).in('game',GAME_IDS).gte('day',since).order('day',{ascending:false}).order('game').order('name').order('scoring_version').range(offset,offset+999)
    if(error)return NextResponse.json({error:'Could not load scores'},{status:503})
    all.push(...data??[])
    if(!data||data.length<1000)break
  }
  const exact=(r:Row)=>!isNytGame(r.game)||(!r.stats.sourceDate||r.stats.sourceDate===r.day)&&(!(typeof r.stats.puzzleId==='string'&&r.stats.puzzleId.startsWith('nyt-archive-'))||r.stats.puzzleId.slice(12)===r.day)
  return NextResponse.json({rows:all.filter(r=>r.scoring_version===scoringVersion(r.game)&&exact(r)),legacyRows:all.filter(r=>r.scoring_version!==scoringVersion(r.game)||!exact(r))},{headers:{'Cache-Control':'no-store'}})
}
