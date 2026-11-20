'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { logResult, markPracticeIfFuture, isPracticeResult } from '@/lib/results'
import { beginKrillionRound, completeKrillionRound, newKrillionRun, restoreKrillionRun, KRILLION_TIERS, type KrillionRun, type KrillionResult, type KrillionJudgment } from '@/lib/krillion'
import KrillionReview from './KrillionReview'
export type { KrillionPuzzle } from '@/lib/krillion'
import type { KrillionPuzzle } from '@/lib/krillion'
export default function KrillionPlay({puzzle,dailyDay}:{puzzle:KrillionPuzzle;dailyDay:string}){
  const storageKey=`krillion:v3:${dailyDay}:${puzzle.date}`
  const [run,setRunState]=useState<KrillionRun>(()=>{try{return restoreKrillionRun(JSON.parse(localStorage.getItem(storageKey)??'null'),Date.now())}catch{return newKrillionRun()}})
  const [clock,setClock]=useState(()=>Date.now()),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[copied,setCopied]=useState(false)
  const current=useRef(run),pending=useRef(false),submittedAt=useRef(0),abort=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null)
  const setRun=useCallback((value:KrillionRun|((r:KrillionRun)=>KrillionRun))=>{const next=typeof value==='function'?value(current.current):value;current.current=next;setRunState(next)},[])
  const remaining=Math.max(0,(run.endsAt??clock)-clock),total=run.outcomes.reduce((sum,r)=>sum+r.score,0),feedback=run.outcomes.at(-1)
  const finish=useCallback((result:KrillionResult)=>{setRun(r=>completeKrillionRound(r,result));setBusy(false);pending.current=false;setMessage('')},[setRun])
  useEffect(()=>{
    const timer=setInterval(()=>setClock(Date.now()),100)
    const refresh=()=>setClock(Date.now())
    document.addEventListener('visibilitychange',refresh)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);abort.current?.abort()}
  },[])
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(run))}catch{};if(run.phase==='done')logResult('krillion',total,run.outcomes.filter(a=>a.accepted).length,dailyDay,{solved:true,sourceDate:puzzle.date,max:700,scoringVersion:2})},[run,total,dailyDay,puzzle.date,storageKey])
  useEffect(()=>{if(run.phase==='answering')input.current?.focus()},[run.phase,run.index])
  const submit=useCallback(async(final=false)=>{
    const state=current.current
    const answer=state.draft.trim(),index=state.index
    // A blank answer only goes to the judge when time runs out, so it can close the round.
    if(state.phase!=='answering'||pending.current||(!answer&&!final))return
    pending.current=true;submittedAt.current=Date.now();setBusy(true);setMessage('')
    const controller=new AbortController();abort.current=controller
    const timeout=setTimeout(()=>controller.abort(),5000)
    try{
      const r=await fetch('/api/krillion/judge',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({day:dailyDay,index,answer})})
      const data=await r.json() as KrillionJudgment&{error?:string}
      if(current.current.phase!=='answering'||current.current.index!==index)return
      if(!r.ok)throw Error(data.error??'Signal lost. Resend your answer.')
      if(data.accepted){finish(data);return}
      if(final||Date.now()>=(current.current.endsAt??0))finish({...data,answer,score:0})
      else{setMessage(`“${answer.length>40?`${answer.slice(0,40)}…`:answer}” wasn’t accepted. Try again — the clock is still running.`);input.current?.focus();input.current?.select()}
    }catch(e){
      if(controller.signal.aborted&&current.current.phase!=='answering')return
      if(final)finish({answer,accepted:false,score:0,reason:'Connection timed out before this answer could be verified.'})
      else setMessage(e instanceof Error?e.message:'Signal lost. Resend your answer.')
    }finally{clearTimeout(timeout);pending.current=false;setBusy(false)}
  },[dailyDay,finish])
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{
      if(run.phase==='answering'&&run.endsAt!==null&&clock>=run.endsAt){
        if(pending.current){if(clock>=Math.max(run.endsAt,submittedAt.current)+4000){abort.current?.abort();finish({answer:run.draft,accepted:false,score:0,reason:'No verified answer before the connection timeout.'})}}
        else void submit(true)
      }
    })
    return()=>cancelAnimationFrame(frame)
  },[clock,run,puzzle.answerMs,finish,submit,setRun])
  function next(){setMessage('');setClock(Date.now());markPracticeIfFuture('krillion',dailyDay);setRun(r=>r.outcomes.length===7?{...r,phase:'done',endsAt:null}:beginKrillionRound(r,Date.now()))}
  const button='krillion-action'
  return <section className="space-y-5" data-testid="krillion-play"><div className="krillion-stage" data-phase={run.phase} style={{backgroundColor:total>=400?'#040a14':total>=100?'#09263e':'#164765'}}>
    {(run.phase==='ready'||total===0)&&<div className="krillion-sky"><svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g fill="#e1f1ee"><path d="M40 60h30V45h35V30h50v15h30v15h40v15H40zM490 105h25V90h35V70h55v20h35v15h40v15H490zM260 40h35V25h45v15h60v15H260z" /></g><path fill="#f9df8f" d="M690 15h50v10h10v50h-10v10h-50V75h-10V25h10z"/><path fill="#071a2c" d="M120 280h155l-15 18H130zM150 261h80v19h-80zM172 217h5v44h-5z"/><path fill="#fa4e87" d="M172 220h-25v12h25z"/><path d="M0 297Q70 285 140 297T280 297T420 297T560 297T700 297T840 297" fill="none" stroke="#2474a4" strokeWidth="10"/></svg>{run.phase==='ready'&&<><div className="krillion-title">KRILLION</div><p className="krillion-subtitle">THE DAILY DIVE</p><p className="krillion-tagline">7 prompts · 25 seconds each · rarer answers sink deeper</p></>}</div>}
    <div className="krillion-ocean-decor" aria-hidden="true"><svg viewBox="0 0 1000 600" preserveAspectRatio="none"><g fill="#041522" opacity=".7"><path d="M90 120q18-16 36 0-18 16-36 0l-10 8v-16zM760 310q22-18 44 0-22 18-44 0l-12 8v-16zM210 440q15-13 30 0-15 13-30 0l-9 6v-12z"/></g><g fill="none" stroke="#9be1ed" opacity=".25"><circle cx="150" cy="210" r="3"/><circle cx="720" cy="80" r="2"/><circle cx="660" cy="480" r="4"/></g></svg><div className="krillion-depth-ruler">{[0,100,200,300].map(n=><span key={n}>{(total*10+n).toLocaleString()}m</span>)}</div></div>
    <div className="krillion-hud"><span>Depth<strong>{(total*10).toLocaleString()}m</strong></span><span className="text-center">Prompt {Math.min(run.index+1,7)} of 7</span><span className="text-right">Score<strong>{total} / 700</strong></span></div>
    <div className="krillion-console space-y-5"><div className="krillion-rounds" aria-label={`${run.outcomes.length} of 7 rounds completed`}>{puzzle.prompts.map((p,i)=><span key={p.id} data-complete={i<run.outcomes.length}/>)}</div>

    {run.phase==='ready'?<><details className="krillion-how"><summary>How to play</summary><p>Seven prompts. One accepted answer per round. You have 25 seconds per prompt. Rejected guesses can be retried before time runs out; rarer accepted answers score more.</p><div className="flex flex-wrap gap-2 text-xs">{Object.entries(KRILLION_TIERS).map(([id,t])=><span key={id} className="rounded px-2 py-1 text-black" style={{background:t.color}}>{t.name} · {t.score}</span>)}</div></details><button className={button} onClick={next} aria-label="Begin dive">▼ Begin descent ▼</button></>:
    run.phase==='done'?<div className="space-y-3" data-testid="krillion-result"><h2 className="font-lora text-2xl">Dive complete</h2><p>{run.outcomes.filter(a=>a.accepted).length} / 7 accepted · {total} points{isPracticeResult('krillion',dailyDay)?' · practice only':''}</p><button className="underline" onClick={()=>{void navigator.clipboard.writeText(`Krillion ${puzzle.date}\n${total}/700 · ${total*10}m\n${run.outcomes.map(r=>r.tier?KRILLION_TIERS[r.tier].name:'Miss').join(' · ')}\nsfjc.dev/games/krillion`).then(()=>setCopied(true))}}>{copied?'Copied':'Copy result'}</button></div>:
    run.phase==='feedback'&&feedback?<div className="space-y-3" role="status"><h2 className="text-2xl font-semibold">{feedback.tier?`${KRILLION_TIERS[feedback.tier].name} · +${feedback.score}`:'No catch · 0'}</h2><p>{feedback.matchedAnswer??feedback.answer??'No answer'}</p><p>{feedback.quip??feedback.reason}</p><button className={button} onClick={next}>{run.outcomes.length===7?'Surface · see results':'Descend · next prompt'}</button></div>:
    <><span>Prompt {run.index+1} / 7</span><h2 className="font-lora text-2xl">{puzzle.prompts[run.index]?.text}</h2><form className="krillion-answer-form" onSubmit={e=>{e.preventDefault();void submit(remaining<=0)}}><div role="timer" aria-label="Seconds remaining" className="krillion-timer tabular-nums">{Math.ceil(remaining/1000)}s</div><div className="h-1 rounded bg-[var(--ink-border)]"><div className="h-full rounded bg-[var(--ink-accent)] transition-[width]" style={{width:`${remaining/puzzle.answerMs*100}%`}} /></div><label className="block"><span className="sr-only">Your answer</span><input ref={input} aria-label="Your answer" autoComplete="off" maxLength={256} disabled={busy||remaining<=0} value={run.draft} onChange={e=>setRun(r=>({...r,draft:e.target.value}))} className="mt-2 block w-full rounded border bg-[var(--ink-bg)] p-3" /></label><button aria-label="Dive · submit answer" className={button} disabled={busy||remaining<=0}>{busy?'Checking…':'DIVE'}</button>{message&&<p role="status">{message}</p>}</form></>}
  </div></div>
  {run.outcomes.length>0&&<details><summary className="cursor-pointer underline">Your completed rounds</summary><ol className="mt-3 space-y-3">{run.outcomes.map((r,i)=><li key={i} className="rounded border p-3"><strong>{i+1}. {puzzle.prompts[i]?.text}</strong><p>{r.matchedAnswer??r.answer??'No answer'} · {r.tier?KRILLION_TIERS[r.tier].name:'Miss'} · {r.score} points</p></li>)}</ol></details>}
  {run.phase==='done'&&<KrillionReview date={puzzle.date} prompts={puzzle.prompts} />}
  </section>
}
