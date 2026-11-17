'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { logResult, markPracticeIfFuture, isPracticeResult } from '@/lib/results'
import { beginKrillionRound, completeKrillionRound, newKrillionRun, pauseKrillion, resumeKrillion, restoreKrillionRun, KRILLION_TIERS, type KrillionRun, type KrillionResult, type KrillionJudgment } from '@/lib/krillion'
import KrillionReview from './KrillionReview'
export type { KrillionPuzzle } from '@/lib/krillion'
import type { KrillionPuzzle } from '@/lib/krillion'
export default function KrillionPlay({puzzle,dailyDay}:{puzzle:KrillionPuzzle;dailyDay:string}){
  const storageKey=`krillion:v3:${dailyDay}:${puzzle.date}`
  const [run,setRunState]=useState<KrillionRun>(()=>{try{return restoreKrillionRun(JSON.parse(localStorage.getItem(storageKey)??'null'),Date.now())}catch{return newKrillionRun()}})
  const [clock,setClock]=useState(()=>Date.now()),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[copied,setCopied]=useState(false)
  const current=useRef(run),pending=useRef(false),submittedAt=useRef(0),abort=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null)
  const setRun=useCallback((value:KrillionRun|((r:KrillionRun)=>KrillionRun))=>{const next=typeof value==='function'?value(current.current):value;current.current=next;setRunState(next)},[])
  const remaining=Math.max(0,(run.endsAt??clock)-(run.pausedAt??clock)),total=run.outcomes.reduce((sum,r)=>sum+r.score,0),feedback=run.outcomes.at(-1)
  const finish=useCallback((result:KrillionResult)=>{setRun(r=>completeKrillionRound(r,result));setBusy(false);pending.current=false;setMessage('')},[setRun])
  useEffect(()=>{
    const timer=setInterval(()=>setClock(Date.now()),100)
    const refresh=()=>setClock(Date.now())
    document.addEventListener('visibilitychange',refresh)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);abort.current?.abort()}
  },[])
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(run))}catch{};if(run.phase==='done')logResult('krillion',total,run.outcomes.filter(a=>a.accepted).length,dailyDay,{solved:true,sourceDate:puzzle.date,max:700,scoringVersion:2})},[run,total,dailyDay,puzzle.date,storageKey])
  useEffect(()=>{if(run.phase==='answering'&&run.pausedAt===null)input.current?.focus()},[run.phase,run.index,run.pausedAt])
  const submit=useCallback(async(final=false)=>{
    const state=current.current
    if(state.phase!=='answering'||state.pausedAt!==null||pending.current)return
    pending.current=true;submittedAt.current=Date.now();setBusy(true);setMessage('')
    const answer=state.draft.trim(),index=state.index
    const controller=new AbortController();abort.current=controller
    const timeout=setTimeout(()=>controller.abort(),5000)
    try{
      const r=await fetch('/api/krillion/judge',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({day:dailyDay,index,answer,final})})
      const data=await r.json() as KrillionJudgment&{error?:string}
      if(current.current.phase!=='answering'||current.current.index!==index)return
      if(!r.ok)throw Error(data.error??'Signal lost. Resend your answer.')
      if(data.correction&&!final){setRun(s=>({...s,draft:data.correction!}));setMessage(`Did you mean “${data.correction}”? Submit again to confirm.`);return}
      if(data.accepted){finish(data);return}
      if(final||Date.now()>=(current.current.endsAt??0))finish({...data,answer,score:0})
      else{setMessage(`“${answer}” wasn’t accepted. Try again — the clock is still running.`);input.current?.focus();input.current?.select()}
    }catch(e){
      if(controller.signal.aborted&&current.current.phase!=='answering')return
      if(final)finish({answer,accepted:false,score:0,reason:'Connection timed out before this answer could be verified.'})
      else setMessage(e instanceof Error?e.message:'Signal lost. Resend your answer.')
    }finally{clearTimeout(timeout);pending.current=false;setBusy(false)}
  },[dailyDay,finish,setRun])
  useEffect(()=>{
    if(run.pausedAt!==null)return
    const frame=requestAnimationFrame(()=>{
      if(run.phase==='preview'&&run.endsAt!==null&&clock>=run.endsAt)setRun(s=>s.phase==='preview'?{...s,phase:'answering',endsAt:s.endsAt!+puzzle.answerMs}:s)
      if(run.phase==='answering'&&run.endsAt!==null&&clock>=run.endsAt){
        if(pending.current){if(clock>=Math.max(run.endsAt,submittedAt.current)+4000){abort.current?.abort();finish({answer:run.draft,accepted:false,score:0,reason:'No verified answer before the connection timeout.'})}}
        else void submit(true)
      }
    })
    return()=>cancelAnimationFrame(frame)
  },[clock,run,puzzle.answerMs,finish,submit,setRun])
  function next(){setMessage('');setClock(Date.now());markPracticeIfFuture('krillion',dailyDay);setRun(r=>r.outcomes.length===7?{...r,phase:'done',endsAt:null}:beginKrillionRound(r,Date.now()))}
  const button='rounded-lg bg-[var(--ink-accent)] px-5 py-3 text-white disabled:opacity-40'
  return <section className="space-y-5" data-testid="krillion-play"><div className="rounded-xl border bg-[var(--ink-paper)] p-5 space-y-4">
    <div className="flex flex-wrap justify-between gap-2"><span>Same-day dive · {puzzle.date}</span><strong>{total} / 700 points · {total*10}m</strong></div>
    {run.phase==='ready'?<><h2 className="font-lora text-2xl">The daily dive</h2><p>Seven prompts. One accepted answer per round. You have 25 seconds after each 3-second preview. Rejected guesses can be retried before time runs out; rarer accepted answers score more.</p><div className="flex flex-wrap gap-2 text-xs">{Object.entries(KRILLION_TIERS).map(([id,t])=><span key={id} className="rounded px-2 py-1 text-black" style={{background:t.color}}>{t.name} · {t.score}</span>)}</div><button className={button} onClick={next}>Begin dive</button></>:
    run.phase==='done'?<div className="space-y-3" data-testid="krillion-result"><h2 className="font-lora text-2xl">Dive complete</h2><p>{run.outcomes.filter(a=>a.accepted).length} / 7 accepted · {total} points{isPracticeResult('krillion',dailyDay)?' · practice only':''}</p><button className="underline" onClick={()=>{void navigator.clipboard.writeText(`Krillion ${puzzle.date}\n${total}/700 · ${total*10}m\n${run.outcomes.map(r=>r.tier?KRILLION_TIERS[r.tier].name:'Miss').join(' · ')}\nsfjc.dev/games/krillion`).then(()=>setCopied(true))}}>{copied?'Copied':'Copy result'}</button></div>:
    run.pausedAt!==null?<div role="dialog" aria-label="Dive paused" className="space-y-4 text-center py-10"><h2 className="text-2xl">Dive paused</h2><p>Your remaining time is saved.</p><button className={button} onClick={()=>{setClock(Date.now());setRun(r=>resumeKrillion(r,Date.now()))}}>Resume dive</button></div>:
    run.phase==='feedback'&&feedback?<div className="space-y-3" role="status"><h2 className="text-2xl font-semibold">{feedback.tier?`${KRILLION_TIERS[feedback.tier].name} · +${feedback.score}`:'No catch · 0'}</h2><p>{feedback.matchedAnswer??feedback.answer??'No answer'}</p><p>{feedback.quip??feedback.reason}</p><button className={button} onClick={next}>{run.outcomes.length===7?'Surface · see results':'Descend · next prompt'}</button></div>:
    <><div className="flex justify-between"><span>Prompt {run.index+1} / 7</span><button className="text-sm underline" disabled={busy} onClick={()=>setRun(r=>pauseKrillion(r,Date.now()))}>Pause dive</button></div><h2 className="font-lora text-2xl">{puzzle.prompts[run.index]?.text}</h2>{run.phase==='preview'?<p role="status">Get ready · {Math.ceil(remaining/1000)}</p>:<form className="space-y-4" onSubmit={e=>{e.preventDefault();void submit(remaining<=0)}}><div role="timer" aria-label="Seconds remaining" className="text-3xl tabular-nums">{Math.ceil(remaining/1000)}s</div><div className="h-1 rounded bg-[var(--ink-border)]"><div className="h-full rounded bg-[var(--ink-accent)] transition-[width]" style={{width:`${remaining/puzzle.answerMs*100}%`}} /></div><label className="block">Your answer<input ref={input} aria-label="Your answer" autoComplete="off" maxLength={256} disabled={busy||remaining<=0} value={run.draft} onChange={e=>setRun(r=>({...r,draft:e.target.value}))} className="mt-2 block w-full rounded border bg-[var(--ink-bg)] p-3" /></label><button className={button} disabled={busy||remaining<=0}>{busy?'Checking…':'Dive · submit answer'}</button>{message&&<p role="status">{message}</p>}</form>}</>}
  </div>
  {run.outcomes.length>0&&<details><summary className="cursor-pointer underline">Your completed rounds</summary><ol className="mt-3 space-y-3">{run.outcomes.map((r,i)=><li key={i} className="rounded border p-3"><strong>{i+1}. {puzzle.prompts[i]?.text}</strong><p>{r.matchedAnswer??r.answer??'No answer'} · {r.tier?KRILLION_TIERS[r.tier].name:'Miss'} · {r.score} points</p></li>)}</ol></details>}
  {run.phase==='done'&&<KrillionReview date={puzzle.date} prompts={puzzle.prompts} />}
  </section>
}
