'use client'
import { useEffect, useRef, useState } from 'react'
import type { Pin } from '@/lib/artifact-scoring'
type Geometry={type:string;coordinates:number[][][]|number[][][][]}
type View={x:number;y:number;width:number}
function geometryPath(g:Geometry):string{
  const polygons=g.type==='Polygon'?[g.coordinates as number[][][]]:g.coordinates as number[][][][]
  return polygons.flatMap(p=>p.map(r=>r.map((point,i)=>`${i?'L':'M'}${((point[0]!+180)*2).toFixed(2)},${((90-point[1]!)*2).toFixed(2)}`).join('')+'Z')).join('')
}
let landPromise:Promise<string[]>|null=null
function landPaths(){return landPromise??=fetch('/maps/world.geojson').then(r=>{if(!r.ok)throw Error('Map unavailable');return r.json()}).then((j:{features:{geometry:Geometry}[]})=>j.features.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry.type)).map(f=>geometryPath(f.geometry))).catch(e=>{landPromise=null;throw e})}
function bounded(v:View):View{const width=Math.max(2.8125,Math.min(720,v.width));return{width,x:Math.max(0,Math.min(720-width,v.x)),y:Math.max(0,Math.min(360-width/2,v.y))}}
export default function MapPicker({pin,onChange,target,region}:{pin:Pin|null;onChange:(p:Pin)=>void;target?:Pin|undefined;region?:number[][][][]|undefined}){
  const [land,setLand]=useState<string[]>([]),[view,setView]=useState<View>({x:0,y:0,width:720})
  const svg=useRef<SVGSVGElement>(null),position=useRef<{clientX:number;clientY:number;view:View}|null>(null),dragged=useRef(false)
  const pointers=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef<{distance:number;view:View}|null>(null)
  useEffect(()=>{let live=true;void landPaths().then(p=>{if(live)setLand(p)}).catch(()=>{});return()=>{live=false}},[])
  function zoom(factor:number){setView(v=>{const width=Math.max(2.8125,Math.min(720,v.width*factor)),cx=pin?(pin.lon+180)*2:v.x+v.width/2,cy=pin?(90-pin.lat)*2:v.y+v.width/4;return bounded({width,x:cx-width/2,y:cy-width/4})})}
  const psize=view.width/140
  return <div className="space-y-2"><div className="flex items-center gap-2"><button type="button" aria-label="Zoom in map" className="rounded border px-3 py-1" onClick={()=>zoom(0.5)} disabled={view.width<=2.8125}>+</button><button type="button" aria-label="Zoom out map" className="rounded border px-3 py-1" onClick={()=>zoom(2)} disabled={view.width>=720}>−</button><button type="button" className="text-sm underline" onClick={()=>setView({x:0,y:0,width:720})}>Reset map</button><span className="text-xs">{Math.round(720/view.width)}× · drag to pan · pinch to zoom</span></div>
    <svg ref={svg} viewBox={`${view.x} ${view.y} ${view.width} ${view.width/2}`} role="application" aria-label="World map. Click to place a pin; drag to pan. Arrow keys adjust your guess." tabIndex={0} className="w-full rounded-lg border bg-[#dcecf2] outline-offset-2" style={{touchAction:'none',cursor:'crosshair'}}
      onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});position.current={clientX:e.clientX,clientY:e.clientY,view};dragged.current=false;if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={distance:Math.hypot(a!.x-b!.x,a!.y-b!.y),view};dragged.current=true}}}
      onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size===2&&pinch.current){const[a,b]=[...pointers.current.values()],base=pinch.current,width=Math.max(2.8125,Math.min(720,base.view.width*base.distance/Math.max(1,Math.hypot(a!.x-b!.x,a!.y-b!.y))));setView(bounded({width,x:base.view.x+(base.view.width-width)/2,y:base.view.y+(base.view.width-width)/4}));dragged.current=true;return}const start=position.current;if(!start)return;const dx=e.clientX-start.clientX,dy=e.clientY-start.clientY;if(Math.hypot(dx,dy)>4)dragged.current=true;if(dragged.current){const box=e.currentTarget.getBoundingClientRect();setView(bounded({width:start.view.width,x:start.view.x-dx/box.width*start.view.width,y:start.view.y-dy/box.height*start.view.width/2}))}}}
      onPointerUp={e=>{if(!dragged.current&&!target&&!region){const b=e.currentTarget.getBoundingClientRect();onChange({lon:(view.x+(e.clientX-b.left)/b.width*view.width)/2-180,lat:Math.max(-85,Math.min(85,90-(view.y+(e.clientY-b.top)/b.height*view.width/2)/2))})}pointers.current.delete(e.pointerId);if(!pointers.current.size){position.current=null;pinch.current=null}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
      onPointerCancel={e=>{pointers.current.delete(e.pointerId);position.current=null;pinch.current=null}}
      onKeyDown={e=>{if(e.key==='+'||e.key==='='){e.preventDefault();zoom(0.5);return}if(e.key==='-'){e.preventDefault();zoom(2);return}if(target||region||!e.key.startsWith('Arrow'))return;e.preventDefault();const step=5*view.width/720;onChange({lat:Math.max(-85,Math.min(85,(pin?.lat??0)+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0))),lon:Math.max(-180,Math.min(180,(pin?.lon??0)+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)))})}}>
      {land.map((d,i)=><path key={i} d={d} fill="#e9e5d4" stroke="#a8a48f" strokeWidth={view.width/1200} />)}
      {region&&<path d={geometryPath({type:'MultiPolygon',coordinates:region})} fill="#237351" fillOpacity="0.35" stroke="#237351" strokeWidth={view.width/800} fillRule="evenodd" />}
      {pin&&<circle cx={(pin.lon+180)*2} cy={(90-pin.lat)*2} r={psize} fill="#8b3e2f" stroke="white" strokeWidth={psize/3} />}
      {target&&!region&&<circle cx={(target.lon+180)*2} cy={(90-target.lat)*2} r={psize} fill="#236548" stroke="white" strokeWidth={psize/3} />}
    </svg><p className="text-xs text-[var(--ink-muted)]">Red: your guess{region?' · green: historical origin region':target?' · green: origin':''}</p></div>
}
