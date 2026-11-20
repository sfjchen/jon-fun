'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import DayNav from '@/components/daily/DayNav'
import TriplesBoard from './TriplesBoard'
import TriplesCard from './TriplesCard'
import { dailySetBoard, allSets, setKey } from '@/lib/set-daily'
import { brokenFeatures, isTriple } from '@/lib/triples'
import { DAILY_EPOCH, validDay } from '@/lib/daily'
import { usePlayDay } from '@/lib/play-day'
import { formatTime } from '@/lib/results'
import { useHotkeys } from '@/lib/keyboard'
type Run={found:number[][];assisted:boolean;elapsedMs:number;activeSince:number|null;started:boolean}
const fresh=():Run=>({found:[],assisted:false,elapsedMs:0,activeSince:null,started:false})
const elapsed=(r:Run,now:number)=>r.elapsedMs+(r.activeSince===null?0:Math.max(0,now-r.activeSince))
function DailyPlay({day}:{day:string}){
  const board=useMemo(()=>dailySetBoard(day),[day]),storageKey=`set:v1:${day}`
  const [run,setState]=useState<Run>(()=>{try{const r=JSON.parse(localStorage.getItem(storageKey)??'null') as Run;if(r&&Array.isArray(r.found)&&r.found.length<=6&&r.found.every(c=>c.length===3&&c.every(x=>board.includes(x))&&isTriple(c[0]!,c[1]!,c[2]!))&&new Set(r.found.map(setKey)).size===r.found.length&&Number.isFinite(r.elapsedMs)&&r.elapsedMs>=0)return {...r,activeSince:null}}catch{}return fresh()})
  const current=useRef(run),[clock,setClock]=useState(()=>Date.now()),[selected,setSelected]=useState<number[]>([]),[hinted,setHinted]=useState<number[]>([]),[message,setMessage]=useState('')
  const done=run.found.length===6,paused=run.activeSince===null&&!done
  const persist=useCallback((r:Run)=>{try{localStorage.setItem(storageKey,JSON.stringify({...r,elapsedMs:elapsed(r,Date.now()),activeSince:null}))}catch{}},[storageKey])
  const commit=useCallback((r:Run)=>{current.current=r;setState(r);persist(r)},[persist])
  useEffect(()=>{const timer=setInterval(()=>{setClock(Date.now());persist(current.current)},500);const pause=()=>{const r=current.current;commit({...r,elapsedMs:elapsed(r,Date.now()),activeSince:null})};const visibility=()=>{if(document.hidden)pause()};window.addEventListener('pagehide',pause);document.addEventListener('visibilitychange',visibility);return()=>{clearInterval(timer);window.removeEventListener('pagehide',pause);document.removeEventListener('visibilitychange',visibility);persist(current.current)}},[commit,persist])
  function resume(){setClock(Date.now());commit({...current.current,activeSince:Date.now(),started:true})}
  function pick(card:number){
    if(paused||done)return
    const cards=selected.includes(card)?selected.filter(c=>c!==card):[...selected,card]
    setSelected(cards);setHinted([]);setMessage('')
    if(cards.length!==3)return
    setSelected([])
    if(!isTriple(cards[0]!,cards[1]!,cards[2]!)){setMessage(`Not a set — check ${brokenFeatures(cards).join(' and ')}.`);return}
    if(run.found.some(c=>setKey(c)===setKey(cards))){setMessage('You already found that set.');return}
    const found=[...run.found,cards],r=current.current
    commit({...r,found,...(found.length===6?{elapsedMs:elapsed(r,Date.now()),activeSince:null}:{})});setMessage(found.length===6?'All six sets found!':'Set found!')
  }
  const pause=()=>{const r=current.current;commit({...r,elapsedMs:elapsed(r,Date.now()),activeSince:null})}
  const hint=()=>{const next=allSets(board).find(c=>!run.found.some(f=>setKey(f)===setKey(c)));if(next){commit({...current.current,assisted:true});setHinted(next);setMessage('Hint shown.')}}
  // Enter or Space starts and resumes, P pauses, H hints, and Backspace or Escape clears the picked cards.
  useHotkeys(k=>{
    if(done)return
    if(paused)return k==='Enter'||k===' '||k==='p'?(resume(),true):false
    if(k==='p')return pause(),true
    if(k==='h'||k==='?')return hint(),true
    if(k==='Backspace'||k==='Escape')return setSelected([]),true
  })
  return <section className="space-y-5" data-testid="set-play"><div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-sm"><strong>{run.found.length} / 6 sets found</strong><span className="tabular-nums" role="timer">{formatTime(Math.floor(elapsed(run,clock)/1000))}</span>{!paused&&!done&&<button className="underline" onClick={pause}>Pause</button>}</div>
    {paused?<div className="set-start"><p className="set-wordmark">SET</p><h2>{run.started?'Puzzle paused':'Find the six sets'}</h2><p>Twelve cards. Six different sets. Every feature must be all alike or all different.</p><button className="set-primary" onClick={resume}>{run.started?'Continue puzzle':'Play daily puzzle'}</button></div>:<><p role="status" className="min-h-6 text-center text-sm">{message||'Select three cards to make a set.'}</p><TriplesBoard board={board} selected={selected} hinted={hinted} disabled={done} onPick={pick}/>{!done&&<div className="flex justify-center gap-3"><button className="set-secondary" onClick={hint}>Hint</button><button className="set-secondary" onClick={()=>setSelected([])} disabled={!selected.length}>Deselect</button></div>}</>}
    {done&&<div className="set-complete space-y-2" data-testid="set-result"><h2 className="text-2xl font-bold">All six sets found!</h2><p>Time: {formatTime(Math.floor(run.elapsedMs/1000))}{run.assisted?' · With hints':''}</p></div>}
    {run.found.length>0&&<details open={done}><summary className="cursor-pointer text-sm font-semibold">Your found sets ({run.found.length})</summary><ol className="mt-3 grid gap-3 sm:grid-cols-2">{run.found.map(cards=><li key={setKey(cards)} className="grid grid-cols-3 gap-1 rounded border p-2">{cards.map(card=><TriplesCard key={card} card={card} selected={false} disabled onPick={()=>{}}/>)}</li>)}</ol></details>}
    <p className="text-center text-xs text-[var(--ink-muted)]">Daily boards generated on sfjc.dev · classic SET rules</p>
  </section>
}
export default function SetGame(){
  const q=useSearchParams(),raw=q.get('d'),day=usePlayDay(validDay(raw)&&raw>=DAILY_EPOCH?raw:null)
  const hydrated=useSyncExternalStore(()=>()=>{},()=>true,()=>false)
  return <div className="mx-auto w-full max-w-3xl"><DayNav title="SET" path="/games/set" day={day} info={<><p>Find all six sets of three cards. For color, shape, count and shading, the three cards must each be all the same or all different.</p><p>The board stays in place as you find different combinations. Use a hint if you get stuck.</p><p>These daily boards are generated on sfjc.dev.</p></>}/><nav className="mb-5 flex justify-center gap-4 text-sm"><span className="set-mode-active">Daily puzzle</span><Link href="/games/triples">Full deck & friends →</Link></nav>{hydrated?<DailyPlay key={day} day={day}/>:<p>Dealing…</p>}</div>
}
