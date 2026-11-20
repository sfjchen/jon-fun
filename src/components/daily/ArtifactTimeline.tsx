'use client'
import { historicalYear } from '@/lib/artifact-scoring'
export default function ArtifactTimeline({ value, truth, onChange }: { value: number | null; truth?: {beginYear:number;endYear:number} | undefined; onChange: (year:number)=>void }) {
  // The axis spans 3000 BCE to 2000 CE; the slider picks period starts up to 1750 CE, so it covers 4750/5000 of it.
  const x=(year:number)=>30+(Math.max(-3000,Math.min(2000,year))+3000)/5000*940
  return <div className="anthro-timeline"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="anthro-year" className="anthro-eyebrow">Timeline selection</label><span className="text-sm">{truth&&<span className="mr-4 text-emerald-800">Truth: {historicalYear(truth.beginYear)}–{historicalYear(truth.endYear)}</span>}{value===null?'Choose a 250-year period':`${historicalYear(value)} – ${historicalYear(value+250)}`}</span></div><div className="relative rounded focus-within:ring-2 focus-within:ring-[#7a1f1a]">
    <svg viewBox="0 0 1000 65" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true"><line x1="30" x2="970" y1="18" y2="18" stroke="#aa9c7d"/>{[-3000,-2000,-1000,0,1000,2000].map(year=><g key={year}><line x1={x(year)} x2={x(year)} y1="27" y2="35" stroke="#8a795b"/></g>)}{truth&&<rect x={x(truth.beginYear)} y="7" width={Math.max(6,x(truth.endYear)-x(truth.beginYear))} height="22" rx="10" fill="#237351"/>}{value!==null&&<rect x={x(value)} y="4" width={Math.max(8,x(value+250)-x(value))} height="28" rx="14" fill="#7a1f1a" stroke="#f7f3ea" strokeWidth="2"/>}</svg>
    <div className="mx-[3%] flex justify-between gap-1 text-[10px] text-[#4a4337] sm:text-xs" aria-hidden="true">{[-3000,-2000,-1000,0,1000,2000].map(year=><span key={year}>{historicalYear(year)}</span>)}</div>
    <input id="anthro-year" aria-label="Year slider" aria-valuetext={value===null?'No period selected':`${historicalYear(value)} to ${historicalYear(value+250)}`} type="range" min={-3000} max={1750} step={125} disabled={!!truth} value={value??0} onChange={e=>onChange(Number(e.target.value))} className="absolute left-[3%] top-0 h-10 w-[89.3%] cursor-crosshair opacity-0"/>
  </div></div>
}
