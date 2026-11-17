'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { logResult, markPracticeIfFuture, isPracticeResult } from '@/lib/results'
export type KrillionPuzzle = { date:string; prompts:{id:string;text:string}[]; localScoring:boolean; practiceOnly?:boolean }
type Answer = { answer:string; accepted:boolean; reason:string }
type Run = { answers:Answer[]; startedAt:number|null }
export default function KrillionPlay({puzzle,dailyDay}:{puzzle:KrillionPuzzle;dailyDay:string}) {
  const storageKey = `krillion:v1:${dailyDay}:${puzzle.date}`
  const [run,setRun] = useState<Run>(() => {try{return JSON.parse(localStorage.getItem(storageKey)??'null') as Run ?? {answers:[],startedAt:null}}catch{return {answers:[],startedAt:null}}})
  const [entry,setEntry] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('')
  const [feedback,setFeedback] = useState<Answer|null>(null)
  const [clock,setClock] = useState(() => Date.now())
  const submitting = useRef(false)
  const pendingAnswer = useRef<string | null>(null)
  const done = run.answers.length === 7
  const remaining = run.startedAt ? Math.max(0,25-Math.floor((clock-run.startedAt)/1000)) : 25
  const total = run.answers.filter(a=>a.accepted).length*1000
  useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),250);return()=>clearInterval(t)},[])
  useEffect(()=>{
    try{localStorage.setItem(storageKey,JSON.stringify(run))}catch{}
    if(done&&!puzzle.practiceOnly)logResult('krillion',total,run.answers.filter(a=>a.accepted).length,dailyDay,{solved:true,sourceDate:puzzle.date,max:7000})
  },[run,done,total,storageKey,puzzle.practiceOnly,puzzle.date,dailyDay])
  const submit = useCallback(async()=>{
    if(submitting.current||done||!run.startedAt||feedback)return
    submitting.current=true;setBusy(true);setError('')
    const answer=pendingAnswer.current ?? (Date.now()-run.startedAt>26000?'':entry.trim())
    pendingAnswer.current=answer
    try{
      const r=await fetch('/api/krillion/judge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:dailyDay,index:run.answers.length,answer})})
      const data=await r.json() as Answer&{error?:string}
      if(!r.ok)throw Error(data.error??'Could not check answer')
      const result={answer,accepted:data.accepted,reason:data.reason}
      setRun(previous=>({answers:[...previous.answers,result],startedAt:null}));setFeedback(result);setEntry('');pendingAnswer.current=null
    }catch(e){setError(e instanceof Error?e.message:'Could not check answer')}
    finally{submitting.current=false;setBusy(false)}
  },[done,run.startedAt,run.answers.length,feedback,entry,dailyDay])
  useEffect(()=>{if(remaining===0&&!busy&&!feedback&&!error)void submit()},[remaining,busy,feedback,error,submit])
  return <section className="space-y-5 rounded-xl border bg-[var(--ink-paper)] p-5" data-testid="krillion-play">
    <p className="text-sm">{puzzle.practiceOnly?`Practice dive · the first captured set is ${puzzle.date}. Yesterday's original isn't available yet.`:`Yesterday’s dive · ${puzzle.date}`}</p>
    <p className="text-xs text-[var(--ink-muted)]">Local scoring: 1,000 points per valid answer; 25 seconds per prompt. The checked local bank accepts listed answers. The optional AI judge can accept additional answers when available. This differs from the official rarity scoring.</p>
    <div className="flex justify-between"><span>Prompt {Math.min(7,run.answers.length+1)} / 7</span><strong>{total.toLocaleString()} points</strong></div>
    {done?<div data-testid="krillion-result"><h2 className="font-lora text-2xl">Dive complete</h2><p className="mt-2">{run.answers.filter(a=>a.accepted).length} / 7 correct · {total.toLocaleString()} points{puzzle.practiceOnly||isPracticeResult('krillion',dailyDay)?' · practice only':''}</p></div>:feedback?<div role="status" className="space-y-3"><h2 className="text-xl">{feedback.accepted?'Accepted · +1,000':'No points this round'}</h2><p>{feedback.answer||'No answer'}</p><p>{feedback.reason}</p><button className="rounded-lg border px-5 py-2" onClick={()=>{setFeedback(null);setClock(Date.now());setRun(r=>({...r,startedAt:Date.now()}))}}>Next prompt →</button></div>:!run.startedAt?<button className="rounded-lg bg-[var(--ink-accent)] px-5 py-3 text-white" onClick={()=>{markPracticeIfFuture('krillion',dailyDay);setClock(Date.now());setRun(r=>({...r,startedAt:Date.now()}))}}>Begin dive</button>:<form className="space-y-4" onSubmit={e=>{e.preventDefault();void submit()}}><p role="timer" aria-label="Seconds remaining" className="text-3xl tabular-nums">{remaining}s</p><h2 className="font-lora text-2xl">{puzzle.prompts[run.answers.length]?.text}</h2><label className="block">Your answer<input autoFocus aria-label="Your answer" className="mt-2 block w-full rounded-lg border bg-[var(--ink-bg)] p-3" maxLength={100} value={entry} disabled={busy} onChange={e=>setEntry(e.target.value)} /></label><button className="rounded-lg bg-[var(--ink-accent)] px-5 py-3 text-white disabled:opacity-50" disabled={busy}>{busy?'Checking…':'Submit answer'}</button>{error&&<p role="alert">{error} Press submit to retry.</p>}</form>}
    {run.answers.length>0&&<details><summary className="cursor-pointer text-sm underline">Review completed prompts</summary><ol className="mt-3 list-inside list-decimal space-y-3 text-sm">{run.answers.map((a,i)=><li key={i}><strong>{puzzle.prompts[i]?.text}</strong><p>{a.answer||'No answer'} · {a.accepted?'1,000':'0'} points</p><p>{a.reason}</p></li>)}</ol></details>}
  </section>
}
