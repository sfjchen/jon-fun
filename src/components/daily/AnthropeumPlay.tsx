'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { artifactScore, snapYear, type Artifact, type Pin } from '@/lib/artifact-scoring'
import { logResult, markPracticeIfFuture, isPracticeResult } from '@/lib/results'
import ArtifactTimeline from './ArtifactTimeline'
import { artifactHintText, hintsRemaining, revealArtifactHint, type ArtifactHints } from '@/lib/artifact-hints'
import MapPicker from '@/components/daily/MapPicker'
export type ArtifactDay = { date: string; artifacts: Artifact[] }
type Guess = { pin: Pin; year: number; total: number }
export default function AnthropeumPlay({ puzzle, dailyDay }: { puzzle: ArtifactDay; dailyDay: string }) {
  const storageKey = `anthropeum:v2:${dailyDay}:${puzzle.date}`
  const [guesses,setGuesses] = useState<Guess[]>(() => { try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as Guess[] } catch { return [] } })
  const [started,setStarted]=useState(()=>{try{return localStorage.getItem(`${storageKey}:started`)==='1'||guesses.length>0}catch{return false}})
  const [round,setRound] = useState(() => Math.min(guesses.length, puzzle.artifacts.length))
  const [pin,setPin] = useState<Pin | null>(null),[year,setYear] = useState<number | null>(null)
  const [image,setImage] = useState(0),[failedImage,setFailedImage] = useState(false),[expanded,setExpanded]=useState(false),[imageLoaded,setImageLoaded]=useState(false)
  const [hintOpen,setHintOpen]=useState(false),[imageZoom,setImageZoom]=useState(1),[copied,setCopied]=useState(false)
  const viewer=useRef<HTMLDivElement>(null),imageCount=puzzle.artifacts[Math.min(round,puzzle.artifacts.length-1)]!.images.length
  /*
   * Moves to the next or previous photograph of the current artifact, wrapping around, and resets its load state and zoom.
   */
  const stepImage=useCallback((d:number)=>{setImage(i=>(i+d+imageCount)%imageCount);setFailedImage(false);setImageLoaded(false);setImageZoom(1)},[imageCount])
  const hintsKey=`anthropeum:hints:v1:${dailyDay}`
  const [hints,setHints]=useState<ArtifactHints>(()=>{try{return JSON.parse(localStorage.getItem(hintsKey)??'{}')}catch{return {}}})
  useEffect(()=>{try{localStorage.setItem(hintsKey,JSON.stringify(hints))}catch{}},[hints,hintsKey])
  useEffect(()=>{
    if(!expanded&&!hintOpen)return
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setExpanded(false);setHintOpen(false)};if(expanded&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();stepImage(e.key==='ArrowRight'?1:-1)}}
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';window.addEventListener('keydown',onKey)
    return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',onKey)}
  },[expanded,hintOpen,stepImage])
  // Shows the photograph viewer in true fullscreen where the browser allows it, closing the viewer when fullscreen ends.
  // Focus goes to the viewer itself rather than its close button, so no focus ring appears on opening.
  useEffect(()=>{
    const el=viewer.current
    if(expanded)el?.focus({preventScroll:true})
    if(!expanded||!el?.requestFullscreen)return
    const onChange=()=>{if(!document.fullscreenElement)setExpanded(false)}
    el.requestFullscreen().then(()=>document.addEventListener('fullscreenchange',onChange)).catch(()=>{})
    return()=>{document.removeEventListener('fullscreenchange',onChange);if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{})}
  },[expanded])
  const done = guesses.length === puzzle.artifacts.length
  const artifact = puzzle.artifacts[Math.min(round,puzzle.artifacts.length-1)]!
  const guess = guesses[round],detail = guess && artifactScore(artifact, guess.pin, guess.year)
  const total = guesses.reduce((sum,g) => sum + g.total,0)
  useEffect(() => {
    try { localStorage.setItem(storageKey,JSON.stringify(guesses)) } catch {}
    if (done) logResult('anthropeum', total, guesses.length, dailyDay, { solved: true, sourceDate: puzzle.date, max: 100000, scoringVersion: 2 })
  }, [guesses, done, total, dailyDay, puzzle.date, storageKey])
  /**
   * Shares the score band row through the phone share sheet, or copies it on desktop.
   */
  async function share(){
    // Same bands and order as the original's share text.
    const band=(n:number)=>n>=9000?'🟦':n>=6000?'🟩':n>=3000?'🟨':'🟥'
    const text=[`Anthropeum · ${puzzle.date}`,guesses.map(g=>band(g.total)).join(''),total.toLocaleString(),'sfjc.dev/games/anthropeum'].join('\n')
    if(navigator.share&&matchMedia('(pointer: coarse)').matches)return navigator.share({text}).catch(()=>{})
    await navigator.clipboard.writeText(text).then(()=>setCopied(true),()=>{})
  }
  function begin(){markPracticeIfFuture('anthropeum',dailyDay);setStarted(true);try{localStorage.setItem(`${storageKey}:started`,'1')}catch{}}
  const photo=<>{failedImage?<p className="p-8 text-center text-white">Image unavailable. Try another photo.</p>:/* Museum photographs are served from their original open collection. */
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={artifact.images[image]} onLoad={()=>setImageLoaded(true)} alt={guess?artifact.title:`Mystery artifact ${round+1}`} onError={()=>setFailedImage(true)}/>}</>
  if(!started)return <section className="anthro-landing" data-testid="anthropeum-landing"><p className="anthro-eyebrow">Ten artifacts · one daily journey</p><h2>Anthropeum</h2><p className="anthro-question">Where in the world, and when, does this human artifact belong?</p><p className="mx-auto max-w-md text-lg">Each day, ten objects. Place them in history by guessing where and when they were made.</p><p className="anthro-eyebrow mb-4 mt-10">{new Date(`${dailyDay}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})}</p><button className="anthro-button" onClick={begin}>Play today’s game</button><p className="mt-10 text-sm">Your progress and score save here on sfjc.dev.</p><details className="mt-8 border-t pt-5 text-left"><summary className="anthro-eyebrow cursor-pointer">How to play</summary><p className="mt-4">Examine the museum object, drop a pin on the map and select a 250-year period. You can zoom, pan, change photographs and adjust your guess before submitting. Each round awards up to 5,000 points for location and 5,000 for time.</p></details></section>
  if (done && round >= puzzle.artifacts.length) return <section className="anthro-results space-y-6" data-testid="anthropeum-result"><p className="anthro-eyebrow">Your daily collection</p><h2 className="font-lora text-4xl">A journey through human history</h2><p className="text-5xl">{total.toLocaleString()} <span className="text-lg text-[var(--ink-muted)]">/ 100,000</span></p><ol className="grid gap-3 sm:grid-cols-2">{puzzle.artifacts.map((a,i)=><li key={a.id} className="border-b py-3"><span className="anthro-eyebrow">Artifact {i+1}</span><p>{a.title}</p><strong>{guesses[i]?.total.toLocaleString()} points</strong></li>)}</ol><button className="anthro-button" onClick={share}>{copied?'Copied':'Share'}</button><p>{isPracticeResult('anthropeum',dailyDay)?'Future preview · practice only.':'Saved to your daily scores.'}</p></section>
  return <section data-testid="anthropeum-play">
    <div className="anthro-topline"><p className="anthro-eyebrow">Round {round+1} of {puzzle.artifacts.length}</p><p className="text-right"><span className="anthro-eyebrow">Score</span><strong className="ml-3 text-xl">{total.toLocaleString()}</strong></p></div>
    <ArtifactTimeline value={guess?.year??year} truth={guess?{beginYear:artifact.beginYear,endYear:artifact.endYear}:undefined} onChange={setYear}/>
    <div className="anthro-arena">
      <div className="anthro-map"><MapPicker key={`${round}:${!!guess}`} pin={guess?.pin??pin} onChange={setPin} {...(guess?{target:artifact.target,region:artifact.polygons}: {})}/></div>
      <aside className="anthro-artifact"><div className="anthro-artifact-image" onClick={()=>{if(!failedImage){setImageZoom(1);setExpanded(true)}}}>{!imageLoaded&&!failedImage&&<p className="absolute text-sm text-white/70">Loading artifact…</p>}{photo}<button aria-label="Expand artifact photograph" title="Expand photograph" className="absolute right-2 top-2 bg-black/70 px-2 py-1 text-white">⛶</button></div>
        <div className="anthro-artifact-copy"><p className="anthro-eyebrow">Museum open collection</p>{artifact.images.length>1&&<div className="mt-2 flex gap-2 overflow-x-auto">{artifact.images.map((src,i)=><button key={src} aria-label={`Photograph ${i+1}`} className={`h-12 w-12 shrink-0 border-2 ${i===image?'border-[#7a1f1a]':'border-transparent'}`} onClick={()=>{setImage(i);setFailedImage(false);setImageLoaded(false)}}>{/* Original museum photograph thumbnail. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover"/></button>)}</div>}{artifact.images.length>1&&<button className="mt-1 text-sm underline" onClick={()=>stepImage(1)}>Another photo ({image+1}/{artifact.images.length})</button>}</div>
        <div className="anthro-artifact-copy"><p className="anthro-eyebrow">Medium</p><p>{artifact.mediumClean||'Mixed materials'}</p></div>
        {!guess&&<div className="anthro-artifact-copy"><div className="flex items-center justify-between"><div><p className="anthro-eyebrow">Hints</p><p className="text-sm">{hintsRemaining(hints)} of 3 left today</p></div><button className="rounded border border-[#7a1f1a] px-3 py-2 text-xs uppercase" onClick={()=>setHintOpen(true)}>Use a hint</button></div>{hints[round]?.map(kind=><p key={kind} className="mt-2 text-sm"><strong>{kind==='time'?'Time':'Place'}:</strong> {artifactHintText(artifact,kind)}</p>)}</div>}
        {guess&&detail?<div className="anthro-artifact-copy space-y-2" role="status"><h3 className="font-lora text-2xl">{artifact.title}</h3><p>{artifact.culture} · {artifact.objectDate}</p><p><strong>{detail.total.toLocaleString()} / 10,000</strong></p><p>Location: {detail.location.toLocaleString()}/5,000 · {detail.km===0?'inside the historical region':`${detail.km.toLocaleString()} km from the region`}</p><p>Date: {detail.time.toLocaleString()}/5,000 · {detail.years} years outside the range</p><details><summary className="cursor-pointer underline">About this artifact</summary><p className="mt-2">{artifact.description}</p><a className="underline" href={artifact.metUrl} target="_blank" rel="noreferrer">Museum record ↗</a></details></div>:<div className="anthro-artifact-copy"><p className="anthro-eyebrow">How to play</p><p className="mt-1">Guess where this object was made and when. Drop a pin, choose a period, then submit your guess.</p></div>}
      </aside>
      {guess?<button className="anthro-button anthro-submit" onClick={()=>{setRound(r=>r+1);setPin(null);setYear(null);setImage(0);setFailedImage(false);setImageLoaded(false)}}>{round===puzzle.artifacts.length-1?'See final score':'Next artifact →'}</button>:<button className="anthro-button anthro-submit" aria-label="Lock in guess" disabled={!pin||year===null} onClick={()=>{if(pin&&year!==null){markPracticeIfFuture('anthropeum',dailyDay);const total=artifactScore(artifact,pin,year).total;setGuesses(previous=>[...previous,{pin,year,total}])}}}>{pin&&year!==null?'Submit guess':'Drop a pin and pick a time'}</button>}
    </div>
    {!guess&&<details className="border-t px-6 py-3 text-sm"><summary className="cursor-pointer text-[var(--ink-muted)]">Precise coordinates and date</summary><div className="anthro-coordinates"><label>Latitude<input aria-label="Latitude" type="number" min={-85} max={85} step="0.1" value={pin?.lat??''} onChange={e=>setPin(p=>({lat:Math.max(-85,Math.min(85,Number(e.target.value))),lon:p?.lon??0}))}/></label><label>Longitude<input aria-label="Longitude" type="number" min={-180} max={180} step="0.1" value={pin?.lon??''} onChange={e=>setPin(p=>({lon:Math.max(-180,Math.min(180,Number(e.target.value))),lat:p?.lat??0}))}/></label><label>Period start<input aria-label="Period start" type="number" min={-3000} max={1750} step={125} value={year??''} onChange={e=>setYear(snapYear(Number(e.target.value)))}/></label></div></details>}
    {expanded&&<div ref={viewer} role="dialog" aria-modal="true" aria-label="Artifact photograph" tabIndex={-1} className="fixed inset-0 z-50 outline-none flex items-center justify-center overflow-hidden bg-black/95" onClick={e=>{if(e.currentTarget===e.target)setExpanded(false)}}>
      <div style={{transform:`scale(${imageZoom})`,transformOrigin:'center'}} onClick={e=>e.stopPropagation()} className="flex h-[calc(100svh-5rem)] w-[calc(100vw-1rem)] items-center justify-center [&_img]:h-full [&_img]:w-full [&_img]:object-contain">{photo}</div>
      <button aria-label="Close photograph" className="absolute right-4 top-3 px-2 text-3xl text-white" onClick={()=>setExpanded(false)}>×</button>
      {imageCount>1&&<><button aria-label="Previous photograph" className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 px-3 py-4 text-3xl text-white" onClick={()=>stepImage(-1)}>‹</button><button aria-label="Next photograph" className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 px-3 py-4 text-3xl text-white" onClick={()=>stepImage(1)}>›</button></>}
      <div className="absolute bottom-4 flex items-center gap-3 text-white">{imageCount>1&&<span aria-live="polite" className="mr-2 text-sm">{image+1} / {imageCount}</span>}<button className="bg-white px-4 py-2 text-black" aria-label="Zoom out photograph" onClick={()=>setImageZoom(z=>Math.max(1,z-.5))}>−</button><button className="bg-white px-4 py-2 text-black" aria-label="Zoom in photograph" onClick={()=>setImageZoom(z=>Math.min(4,z+.5))}>+</button></div>
    </div>}
    {hintOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e=>{if(e.target===e.currentTarget)setHintOpen(false)}}><section role="dialog" aria-modal="true" aria-label="Artifact hints" className="w-full max-w-sm border border-[#dcd2bc] bg-[#f7f3ea] p-6"><div className="flex justify-between"><h3 className="anthro-eyebrow">Hints</h3><button autoFocus aria-label="Close hints" onClick={()=>setHintOpen(false)}>×</button></div><p className="my-4">Three hints across all ten rounds. Hints never cost points. {hintsRemaining(hints)} left today.</p>{(['time','place']as const).map(kind=><div key={kind} className="flex items-center justify-between gap-4 border-t border-[#dcd2bc] py-4"><div><strong>{kind==='time'?'Time':'Place'}</strong><p className="text-sm">{hints[round]?.includes(kind)?artifactHintText(artifact,kind):kind==='time'?'A 1,000-year span':'The world region it comes from'}</p></div><button disabled={hintsRemaining(hints)===0||hints[round]?.includes(kind)} onClick={()=>setHints(h=>revealArtifactHint(h,round,kind))} className="rounded border border-[#7a1f1a] px-3 py-2 text-xs uppercase disabled:opacity-40">{hints[round]?.includes(kind)?'Revealed':'Reveal'}</button></div>)}</section></div>}
  </section>
}
