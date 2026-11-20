import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GAMES, GAME_IDS, likeName, scoringVersion, type GameId } from '@/lib/results'
import { score as beeScore } from '@/lib/spelling-bee'
import { DAILY_EPOCH, siteDay, validDay } from '@/lib/daily'
import { isNytGame, NYT_FIRST_DAY } from '@/lib/daily/nyt-puzzles'
import { supabaseAdmin } from '@/lib/supabase'
import { VERIFIERS } from '@/lib/daily/verify'
import { DEVICE_KINDS } from '@/lib/syncIdentity'
const group=z.string().regex(/^[a-z0-9-]{3,32}$/)
const stats=z.object({n:z.number().int().min(0).max(500).optional(),seconds:z.number().int().min(0).max(864000).optional(),mistakes:z.number().int().min(0).max(100).optional(),solved:z.boolean().optional(),max:z.number().int().min(1).max(100000).optional(),sourceDate:z.string().refine(validDay).optional(),puzzleId:z.string().max(100).optional(),scoringVersion:z.number().int().min(1).max(2).optional(),hard:z.boolean().optional(),moves:z.unknown().optional()})
const schema=z.object({group,name:z.string().trim().min(1).max(24),deviceId:z.string().uuid().optional(),device:z.enum(DEVICE_KINDS).optional(),today:z.string().refine(validDay),game:z.enum(GAME_IDS as [GameId,...GameId[]]),score:z.number().int().min(0),n:z.number().int().min(0).max(500).optional(),stats:stats.optional()})
export async function POST(req:Request){
  const parsed=schema.safeParse(await req.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:'Invalid result'},{status:400})
  const b=parsed.data
  if(b.today<(isNytGame(b.game)?NYT_FIRST_DAY[b.game]:DAILY_EPOCH)||b.today>siteDay())return NextResponse.json({error:'Date out of range'},{status:400})
  if(isNytGame(b.game)&&b.stats?.sourceDate&&b.stats.sourceDate!==b.today)return NextResponse.json({error:'Puzzle source date does not match the result date'},{status:400})
  // Every score is recomputed from the game's moves against the day's puzzle, so a hand-made score cannot be posted.
  // The moves are checked, then dropped, since stored moves would reveal the answers to anyone reading scores.
  const {moves,...rest}=b.stats??{},v=VERIFIERS[b.game],m=v.moves.safeParse(moves)
  if(!m.success)return NextResponse.json({error:`${GAMES[b.game].title} results need their moves`},{status:400})
  let game
  try{game=await v.check(b.today,m.data as never,rest)}
  catch{return NextResponse.json({error:'Could not check this result. It remains queued on your device.'},{status:503})}
  if(typeof game==='string')return NextResponse.json({error:game},{status:400})
  if(game.score>GAMES[b.game].max)return NextResponse.json({error:'Score out of range'},{status:400})
  const version=scoringVersion(b.game),score=game.score
  // Names are unique per board regardless of case and spacing, so "jon" on a phone files under an existing "Jon".
  const clean=b.name.replace(/\s+/g,' ')
  const same=await supabaseAdmin.from('game_results').select('name').eq('group_code',b.group).ilike('name',likeName(clean)).order('created_at').limit(1)
  if(same.error)return NextResponse.json({error:'Could not save score. It remains queued on your device.'},{status:503})
  const name=same.data[0]?.name??clean
  const key={group_code:b.group,name,game:b.game,day:b.today,scoring_version:version}
  // Spelling Bee keeps its checked words in a column the leaderboard never reads, so a player's devices share them.
  const words=b.game==='bee'?[...new Set(m.data as string[])]:null
  const value={...key,score,...(words?{words}:{}),...(b.deviceId?{device_id:b.deviceId}:{}),...(b.device?{device_kind:b.device}:{}),stats:{...rest,...game.stats,scoringVersion:version}}
  const inserted=await supabaseAdmin.from('game_results').insert(value)
  if(inserted.error&&inserted.error.code!=='23505')return NextResponse.json({error:'Could not save score. It remains queued on your device.'},{status:503})
  if(inserted.error?.code==='23505'&&words){
    // Another device already filed this day, so the saved words grow to cover both and the score follows them.
    const old=await supabaseAdmin.from('game_results').select('score,words').match(key).single()
    if(old.error)return NextResponse.json({error:'Could not sync score'},{status:503})
    const all=[...new Set([...(old.data.words as string[]|null??[]),...words])],pts=all.reduce((t,w)=>t+beeScore(w),0)
    const update=await supabaseAdmin.from('game_results').update({words:all,
      ...(pts>old.data.score?{score:pts,stats:{...value.stats,n:all.length,solved:pts===value.stats.max}}:{})}).match(key)
    if(update.error)return NextResponse.json({error:'Could not sync score'},{status:503})
  }
  // Every game's first finished result is immutable, so clearing a board or browser data cannot replace it. Spelling
  // Bee only grows, since its score rises as more words are found the same day.
  return NextResponse.json({ok:true,name})
}
export async function GET(req:Request){
  const q=new URL(req.url).searchParams,g=group.safeParse(q.get('group'))
  if(!g.success)return NextResponse.json({error:'Invalid group'},{status:400})
  const days=Math.min(6000,Math.max(1,Number(q.get('days'))||400)),since=new Date(Date.now()-(days+1)*86400000).toISOString().slice(0,10)
  type Row={name:string;game:GameId;day:string;score:number;stats:Record<string,unknown>;scoring_version:number;device_kind:string|null}
  const all:Row[]=[]
  for(let offset=0;offset<100000;offset+=1000){
    const {data,error}=await supabaseAdmin.from('game_results').select('name,game,day,score,stats,scoring_version,device_kind').eq('group_code',g.data).in('game',GAME_IDS).gte('day',since).order('day',{ascending:false}).order('game').order('name').order('scoring_version').range(offset,offset+999)
    if(error)return NextResponse.json({error:'Could not load scores'},{status:503})
    all.push(...data??[])
    if(!data||data.length<1000)break
  }
  const exact=(r:Row)=>!isNytGame(r.game)||(!r.stats.sourceDate||r.stats.sourceDate===r.day)&&(!(typeof r.stats.puzzleId==='string'&&r.stats.puzzleId.startsWith('nyt-archive-'))||r.stats.puzzleId.slice(12)===r.day)
  const out=(r:Row)=>{const {device_kind,...rest}=r;return device_kind?{...rest,device:device_kind}:rest}
  return NextResponse.json({rows:all.filter(r=>r.scoring_version===scoringVersion(r.game)&&exact(r)).map(out),legacyRows:all.filter(r=>r.scoring_version!==scoringVersion(r.game)||!exact(r)).map(out)},{headers:{'Cache-Control':'no-store'}})
}
