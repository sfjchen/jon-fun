'use client'
import { useEffect, useState } from 'react'
import type { Pin } from '@/lib/artifact-scoring'
type Geometry = { type: string; coordinates: number[][][] | number[][][][] }
function geometryPath(g: Geometry): string {
  const polygons = g.type === 'Polygon' ? [g.coordinates as number[][][]] : g.coordinates as number[][][][]
  return polygons.flatMap(p => p.map(ring => ring.map((point, i) => `${i ? 'L' : 'M'}${((point[0]! + 180) * 2).toFixed(1)},${((90 - point[1]!) * 2).toFixed(1)}`).join('') + 'Z')).join('')
}
export default function MapPicker({ pin, onChange, target }: { pin: Pin | null; onChange: (pin: Pin) => void; target?: Pin | undefined }) {
  const [land, setLand] = useState<string[]>([])
  useEffect(() => {
    fetch('/maps/world.geojson').then(r => r.json()).then((j: { features: { geometry: Geometry }[] }) => setLand(j.features.filter(f => ['Polygon','MultiPolygon'].includes(f.geometry.type)).map(f => geometryPath(f.geometry)))).catch(() => {})
  }, [])
  return <div className="space-y-2"><svg viewBox="0 0 720 360" role="application" aria-label="World map. Click to place your location guess, or use arrow keys." tabIndex={0} className="w-full rounded-lg border bg-[#dcecf2] outline-offset-2" onClick={e => {
    if (target) return
    const box = e.currentTarget.getBoundingClientRect()
    onChange({ lon: Math.max(-180,Math.min(180,(e.clientX - box.left) / box.width * 360 - 180)), lat: Math.max(-85,Math.min(85,90 - (e.clientY - box.top) / box.height * 180)) })
  }} onKeyDown={e => {
    if (target || !e.key.startsWith('Arrow')) return
    e.preventDefault()
    onChange({ lat: Math.max(-85,Math.min(85,(pin?.lat ?? 0) + (e.key === 'ArrowUp' ? 5 : e.key === 'ArrowDown' ? -5 : 0))), lon: Math.max(-180,Math.min(180,(pin?.lon ?? 0) + (e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0))) })
  }}>
    {[-120,-60,0,60,120].map(lon => <line key={lon} x1={(lon+180)*2} x2={(lon+180)*2} y1="0" y2="360" stroke="#adc8ce" strokeWidth="0.5" />)}
    {[-60,-30,0,30,60].map(lat => <line key={lat} x1="0" x2="720" y1={(90-lat)*2} y2={(90-lat)*2} stroke="#adc8ce" strokeWidth="0.5" />)}
    {land.map((d,i) => <path d={d} key={i} fill="#e9e5d4" stroke="#a8a48f" strokeWidth="0.6" />)}
    {pin && <circle cx={(pin.lon+180)*2} cy={(90-pin.lat)*2} r="5" fill="#8b3e2f" stroke="white" strokeWidth="2" />}
    {target && <><circle cx={(target.lon+180)*2} cy={(90-target.lat)*2} r="5" fill="#236548" stroke="white" strokeWidth="2" />{pin && <line x1={(pin.lon+180)*2} y1={(90-pin.lat)*2} x2={(target.lon+180)*2} y2={(90-target.lat)*2} stroke="#236548" strokeDasharray="4" />}</>}
  </svg><p className="text-xs text-[var(--ink-muted)]">Modern world map · red: your guess{target ? ' · green: approximate origin' : ' · click or use arrow keys to place a pin'}</p></div>
}
