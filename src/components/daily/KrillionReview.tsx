'use client'
import { useEffect, useState } from 'react'
import { KRILLION_TIERS, type KrillionAnswer } from '@/lib/krillion'
type ReviewPage={total:number;page:number;pageSize:number;answers:KrillionAnswer[]}
export default function KrillionReview({date,prompts,index,onIndex:setIndex}:{date:string;prompts:{id:string;text:string}[];index:number;onIndex:(i:number)=>void}){
  const [search,setSearch]=useState(''),[tier,setTier]=useState('all'),[page,setPage]=useState(0)
  const [response,setResponse]=useState<{key:string;data?:ReviewPage;error?:string}|null>(null)
  const key=`${date}:${index}:${search}:${tier}:${page}`
  useEffect(()=>{
    const controller=new AbortController()
    const timer=setTimeout(()=>{
      const q=new URLSearchParams({d:date,prompt:String(index),q:search,tier,page:String(page)})
      fetch(`/api/krillion/review?${q}`,{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error??'Could not load answers');setResponse({key,data})}).catch(e=>{if(!controller.signal.aborted)setResponse({key,error:e instanceof Error?e.message:'Could not load answers'})})
    },150)
    return()=>{clearTimeout(timer);controller.abort()}
  },[date,index,search,tier,page,key])
  const data=response?.key===key?response.data:undefined,error=response?.key===key?response.error:undefined
  return <section className="space-y-4 rounded-xl border p-4" data-testid="krillion-review" id="krillion-sheet"><h3 className="font-lora text-xl">Answer sheets · every accepted answer</h3>
    <label className="block text-sm">Prompt<select aria-label="Review prompt" value={index} className="mt-2 block w-full rounded border bg-[var(--ink-paper)] p-2" onChange={e=>{setIndex(Number(e.target.value));setPage(0)}}>{prompts.map((p,i)=><option key={p.id} value={i}>{i+1}. {p.text}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><input aria-label="Search accepted answers" placeholder="Search answers or aliases…" value={search} className="min-w-0 flex-1 rounded border bg-[var(--ink-paper)] p-2" onChange={e=>{setSearch(e.target.value);setPage(0)}} /><select aria-label="Rarity tier" value={tier} className="rounded border bg-[var(--ink-paper)] p-2" onChange={e=>{setTier(e.target.value);setPage(0)}}><option value="all">All tiers</option>{Object.entries(KRILLION_TIERS).map(([id,t])=><option key={id} value={id}>{t.name} · {t.score}</option>)}</select></div>
    {error&&<p role="alert">{error}</p>}{!data&&!error&&<p>Loading answer key…</p>}
    {data&&<><p className="text-sm">{data.total.toLocaleString()} accepted {data.total===1?'answer':'answers'}{search?' matching your search':''}</p><ul className="space-y-2">{data.answers.map(a=><li key={a.answer} className="rounded border p-3"><div className="flex flex-wrap justify-between gap-3"><strong className="min-w-0 break-words">{a.answer}</strong><span className="shrink-0 text-sm">{KRILLION_TIERS[a.tier].name} · {a.score}</span></div>{a.quip&&<p className="mt-1 text-sm">{a.quip}</p>}{a.aliases?.length? <details className="mt-1 text-xs"><summary className="cursor-pointer">Accepted aliases</summary><p className="break-words">{a.aliases.join(' · ')}</p></details>:null}</li>)}</ul><div className="flex items-center justify-between"><button className="rounded border px-4 py-2 disabled:opacity-40" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous answers</button><span className="whitespace-nowrap text-sm">{data.total?`${page+1} / ${Math.ceil(data.total/data.pageSize)}`:'No matches'}</span><button className="rounded border px-4 py-2 disabled:opacity-40" disabled={(page+1)*data.pageSize>=data.total} onClick={()=>setPage(p=>p+1)}>Next answers</button></div></>}
  </section>
}
