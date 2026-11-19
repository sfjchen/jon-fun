'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime, logResult, isPracticeResult, markPracticeIfFuture } from '@/lib/results'
import { emptyMini, miniElapsed, pauseMini, resumeMini, finishMini, restoreMini, type MiniPuzzle, type MiniRun } from '@/lib/mini'
export type { MiniPuzzle } from '@/lib/mini'
/**
 * Renders a small dropdown of actions that closes after a pick or an outside click.
 */
function Menu({label,items}:{label:string;items:[string,()=>void][]}){
  const [open,setOpen]=useState(false),box=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open])
  return <div ref={box} className="relative"><button className="rounded-full px-3 py-2 text-sm font-medium hover:bg-[var(--ink-border)]/40" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>{label} ▾</button>
    {open&&<div role="menu" className="absolute right-0 top-10 z-30 min-w-36 rounded-lg border bg-[var(--ink-paper)] py-1 shadow-lg">{items.map(([name,run])=><button key={name} role="menuitem" className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--ink-border)]/40" onClick={()=>{setOpen(false);run()}}>{name}</button>)}</div>}</div>
}

export default function MiniPlay({puzzle,dailyDay}:{puzzle:MiniPuzzle;dailyDay?:string}){
  const storageKey=`mini:v3:${dailyDay??'archive'}:${puzzle.date}`
  // A fresh puzzle starts its clock on load; only a puzzle paused by leaving the page asks to continue.
  const [run,setRun]=useState<MiniRun>(()=>{let r:MiniRun;try{r=restoreMini(JSON.parse(localStorage.getItem(storageKey)??'null'),puzzle)}catch{r=emptyMini(puzzle)};return r.started?r:resumeMini(r,Date.now())})
  const current=useRef(run),inputs=useRef<(HTMLInputElement|null)[]>([])
  const [active,setActive]=useState(()=>puzzle.cells.findIndex(Boolean)),[direction,setDirection]=useState('Across'),[clock,setClock]=useState(()=>Date.now())
  const [pencil,setPencil]=useState(false),[autocheck,setAutocheck]=useState(false),[rebus,setRebus]=useState(false)
  const [wrong,setWrong]=useState<number[]>([]),[message,setMessage]=useState('')
  const save=useCallback((r:MiniRun)=>{try{localStorage.setItem(storageKey,JSON.stringify(pauseMini(r,Date.now())))}catch{}},[storageKey])
  const commit=useCallback((r:MiniRun)=>{current.current=r;setRun(()=>r);save(r)},[save])
  const clue=puzzle.clues.find(c=>c.direction===direction&&c.cells.includes(active))??puzzle.clues.find(c=>c.cells.includes(active))
  const paused=run.activeSince===null&&!run.complete
  const seconds=Math.floor(miniElapsed(run,clock)/1000)
  useEffect(()=>{
    const timer=setInterval(()=>{setClock(Date.now());save(current.current)},1000)
    const leave=()=>{const stopped=pauseMini(current.current,Date.now());current.current=stopped;setRun(stopped);save(stopped)}
    const visibility=()=>{if(document.hidden)leave()}
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);save(current.current)}
  },[save])
  useEffect(()=>{if(dailyDay&&run.firstSolveSeconds!==null&&!run.assisted)logResult('mini',run.firstSolveSeconds,undefined,dailyDay,{seconds:run.firstSolveSeconds,solved:true,sourceDate:puzzle.date,puzzleId:`mini:${puzzle.date}`,scoringVersion:2})},[run.firstSolveSeconds,run.assisted,dailyDay,puzzle.date])
  function focus(i:number,d=direction){if(puzzle.cells[i]){setActive(i);setDirection(d);inputs.current[i]?.focus();inputs.current[i]?.select()}}
  function nextClue(step:number){const i=puzzle.clues.indexOf(clue!),next=puzzle.clues[(i+step+puzzle.clues.length)%puzzle.clues.length]!;focus(next.cells.find(i=>!current.current.entries[i])??next.cells[0]!,next.direction)}
  function advance(){const indices=clue?.cells??[active],offset=indices.indexOf(active);const next=[...indices.slice(offset+1),...indices.slice(0,offset)].find(i=>!current.current.entries[i]);if(next!==undefined)focus(next);else if(offset<indices.length-1)focus(indices[offset+1]!);else nextClue(1)}
  function enter(i:number,value:string){
    if(paused||run.complete)return
    markPracticeIfFuture('mini',dailyDay)
    const letters=value.toUpperCase().replace(/[^A-Z]/g,''),text=rebus?letters:letters.slice(-1)
    const r=current.current,entries=r.entries.map((v,j)=>j===i?text:v)
    const confirmed=autocheck&&text===puzzle.cells[i]?[...new Set([...r.confirmed,i])]:r.confirmed.filter(j=>j!==i)
    const next={...r,entries,pencil:pencil?[...new Set([...r.pencil,i])]:r.pencil.filter(j=>j!==i),confirmed,assisted:r.assisted||autocheck}
    // eslint-disable-next-line react-hooks/purity -- Called only by input events; sample the exact completion time.
    commit(finishMini(next,puzzle,Date.now()));setClock(Date.now());setMessage('');setWrong(previous=>autocheck&&text&&text!==puzzle.cells[i]?[...new Set([...previous,i])]:previous.filter(j=>j!==i))
    if(text&&!rebus)advance()
  }
  function help(reveal:boolean,scope:string){
    const indices=scope==='square'?[active]:scope==='word'?(clue?.cells??[active]):puzzle.cells.flatMap((a,i)=>a?[i]:[])
    const r=current.current,entries=reveal?r.entries.map((v,i)=>indices.includes(i)?puzzle.cells[i]??'':v):r.entries
    const confirmed=[...new Set([...r.confirmed,...indices.filter(i=>entries[i]&&entries[i]===puzzle.cells[i])])]
    // eslint-disable-next-line react-hooks/purity -- Called only by a help-button event, never while rendering.
    commit(finishMini({...r,entries,confirmed,assisted:true},puzzle,Date.now()));setClock(Date.now())
    setWrong(indices.filter(i=>entries[i]&&entries[i]!==puzzle.cells[i]));setMessage(reveal?'Correct letters revealed. Assisted solve.':'Checked filled squares. Incorrect letters are marked; confirmed letters are blue.')
  }
  function clearPuzzle(){
    if(!window.confirm('Clear the grid and restart the timer? Your first recorded solve time stays unchanged.'))return
    const r={...emptyMini(puzzle),assisted:run.assisted,firstSolveSeconds:run.firstSolveSeconds}
    // eslint-disable-next-line react-hooks/purity -- Explicit clear-button event resets the active clock.
    commit(resumeMini(r,Date.now()));setClock(Date.now());setWrong([]);setMessage('');focus(puzzle.cells.findIndex(Boolean))
  }
  useEffect(()=>{if(!paused&&!run.complete)inputs.current[active]?.focus()},[paused,run.complete,active])
  const status=run.complete?run.assisted?'Solved with help · not ranked':`Solved in ${formatTime(seconds)}!`:''
  const tool='rounded-full px-3 py-2 text-sm font-medium hover:bg-[var(--ink-border)]/40 disabled:opacity-30'
  const toolbar=<div className="flex items-center gap-1 border-b pb-2" style={{borderColor:'var(--ink-border)'}}>
    <button className={`${tool} tabular-nums`} disabled={run.complete} title={paused?'Resume':'Pause'} aria-label={paused?'Resume puzzle':'Pause puzzle'} onClick={()=>{setClock(Date.now());commit(paused?resumeMini(current.current,Date.now()):pauseMini(current.current,Date.now()))}}>{run.complete?'':paused?'▶ ':'❚❚ '}{formatTime(seconds)}</button>
    <span className="mr-auto text-xs text-[var(--ink-muted)]">{run.assisted&&!run.complete?'Assisted · not ranked':dailyDay&&isPracticeResult('mini',dailyDay)?'Practice':''}</span>
    {!paused&&!run.complete&&<>
      <button className={tool} aria-pressed={pencil} title="Pencil: gray, tentative letters" style={pencil?{background:'var(--ink-text)',color:'var(--ink-bg)'}:undefined} onClick={()=>setPencil(v=>!v)}>✏️</button>
      <Menu label="Check" items={[['Autocheck'+(autocheck?' ✓':''),()=>{const on=!autocheck;setAutocheck(on);if(on)commit({...current.current,assisted:true})}],['Square',()=>help(false,'square')],['Word',()=>help(false,'word')],['Puzzle',()=>help(false,'puzzle')]]} />
      <Menu label="Reveal" items={[['Square',()=>help(true,'square')],['Word',()=>help(true,'word')],['Puzzle',()=>help(true,'puzzle')],['Clear puzzle',clearPuzzle]]} />
    </>}
  </div>
  if(paused)return <section className="space-y-4">{toolbar}<div className="space-y-4 rounded-xl border bg-[var(--ink-paper)] p-8 text-center" role="dialog" aria-label="Mini paused"><h3 className="font-lora text-2xl">Paused</h3><p className="text-sm text-[var(--ink-muted)]">By {puzzle.constructors.join(', ')}</p><button className="rounded-full bg-[var(--ink-text)] px-8 py-3 font-semibold text-[var(--ink-bg)]" aria-label="Continue puzzle" onClick={()=>{setClock(Date.now());commit(resumeMini(current.current,Date.now()))}}>Continue</button></div></section>
  return <section className="space-y-3">{toolbar}
    {rebus&&<p className="text-sm">Rebus: type several letters, then Enter. Escape exits.</p>}
    <div className="mx-auto w-full max-w-sm space-y-2">
    <div role="status" aria-live="polite" className="flex min-h-12 items-center gap-1 rounded-lg px-1 text-sm font-medium" style={{background:'#dce7fa',color:'#111'}}>
      {status?<span className="flex-1 px-2 text-center font-semibold">{status}</span>:<><button className="px-2 py-2 text-lg" aria-label="Previous clue" onClick={()=>nextClue(-1)}>‹</button><span className="flex-1">{message||<><strong>{clue?.number}{clue?.direction[0]}</strong> {clue?.text}</>}</span><button className="px-2 py-2 text-lg" aria-label="Next clue" onClick={()=>nextClue(1)}>›</button></>}
    </div>
    <div className="grid w-full border-2 border-black" style={{gridTemplateColumns:`repeat(${puzzle.width},minmax(0,1fr))`}}>
      {puzzle.cells.map((answer,i)=>{const number=puzzle.clues.find(c=>c.cells[0]===i)?.number;return <div key={i} className="relative aspect-square border" style={{background:answer?i===active?'#f9df6d':clue?.cells.includes(i)?'#dce7fa':'var(--ink-paper)':'#222'}}>{number&&<span className="pointer-events-none absolute left-1 top-0 z-10 text-xs text-black">{number}</span>}{answer&&<input ref={e=>{inputs.current[i]=e}} aria-label={`Row ${Math.floor(i/puzzle.width)+1}, column ${i%puzzle.width+1}${number?`, ${number}`:''}`} aria-invalid={wrong.includes(i)} autoComplete="off" autoCapitalize="characters" spellCheck={false} readOnly={run.complete} value={run.entries[i]} className="h-full w-full min-w-0 bg-transparent pt-2 text-center text-xl font-semibold outline-offset-[-3px]" style={{color:wrong.includes(i)?'#b91c1c':run.confirmed.includes(i)?'#1d4ed8':run.pencil.includes(i)?'#71717a':'#222'}} onFocus={e=>{setActive(i);e.currentTarget.select()}} onPointerDown={e=>{if(document.activeElement===e.currentTarget)setDirection(d=>d==='Across'?'Down':'Across')}} onChange={e=>enter(i,e.target.value)} onKeyDown={e=>{
        if(e.key==='Tab'){e.preventDefault();nextClue(e.shiftKey?-1:1);return}
        if(e.key==='Escape'){e.preventDefault();setRebus(v=>!v);return}
        if(e.key==='Enter'){e.preventDefault();if(rebus){setRebus(false);advance()}else nextClue(1);return}
        if(e.key===' '){e.preventDefault();setDirection(d=>d==='Across'?'Down':'Across');return}
        if(e.key.startsWith('Arrow')){e.preventDefault();const d=e.key==='ArrowLeft'||e.key==='ArrowRight'?'Across':'Down';if(d!==direction){setDirection(d);return}const step=(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)*(d==='Across'?1:puzzle.width),next=i+step;if(next>=0&&next<puzzle.cells.length&&puzzle.cells[next]&&(d!=='Across'||Math.floor(next/puzzle.width)===Math.floor(i/puzzle.width)))focus(next);return}
        if(run.complete)return
        if(!rebus&&/^[a-z]$/i.test(e.key)&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();enter(i,e.key);return}
        if(e.key==='Backspace'&&!rebus){e.preventDefault();const indices=clue?.cells??[i],previous=indices[indices.indexOf(i)-1];if(!run.entries[i]&&previous!==undefined){enter(previous,'');focus(previous)}else{enter(i,'');if(previous!==undefined)focus(previous)}}
      }} />}{wrong.includes(i)&&<span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-1 text-xs text-red-700">×</span>}</div>})}
    </div>
    </div>
    <div className="grid gap-6 sm:grid-cols-2">{['Across','Down'].map(d=><div key={d}><h3 className="text-lg font-semibold">{d}</h3><ul className="space-y-2">{puzzle.clues.filter(c=>c.direction===d).map(c=><li key={c.number}><button className="w-full rounded p-1 text-left hover:underline" aria-pressed={clue===c} style={{background:clue===c?'var(--ink-bg)':undefined}} onClick={()=>focus(c.cells.find(i=>!run.entries[i])??c.cells[0]!,d)}><strong>{c.number}.</strong> {c.text}</button></li>)}</ul></div>)}</div>
  </section>
}
