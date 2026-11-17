'use client'
import { useEffect, useState } from 'react'
import { artifactScore, type Artifact, type Pin } from '@/lib/artifact-scoring'
import { logResult, markPracticeIfFuture, isPracticeResult } from '@/lib/results'
import MapPicker from '@/components/daily/MapPicker'
export type ArtifactDay = { date: string; artifacts: Artifact[] }
type Guess = { pin: Pin; year: number; total: number }
export default function AnthropeumPlay({ puzzle, dailyDay }: { puzzle: ArtifactDay; dailyDay: string }) {
  const storageKey = `anthropeum:v1:${dailyDay}:${puzzle.date}`
  const [guesses,setGuesses] = useState<Guess[]>(() => { try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as Guess[] } catch { return [] } })
  const [round,setRound] = useState(() => Math.min(guesses.length, puzzle.artifacts.length - 1))
  const [pin,setPin] = useState<Pin | null>(null)
  const [year,setYear] = useState(1000)
  const [image,setImage] = useState(0)
  const [failedImage,setFailedImage] = useState(false)
  const done = guesses.length === puzzle.artifacts.length
  const artifact = puzzle.artifacts[round]!
  const guess = guesses[round]
  const detail = guess && artifactScore(artifact, guess.pin, guess.year)
  const total = guesses.reduce((sum,g) => sum + g.total,0)
  useEffect(() => {
    try { localStorage.setItem(storageKey,JSON.stringify(guesses)) } catch {}
    if (done) logResult('anthropeum', total, guesses.length, dailyDay, { solved: true, sourceDate: puzzle.date, max: 10000 })
  }, [guesses, done, total, dailyDay, puzzle.date, storageKey])
  if (done && round >= puzzle.artifacts.length - 1) return <section className="space-y-4 rounded-xl border p-5" data-testid="anthropeum-result"><h2 className="font-lora text-2xl">Your museum tour is complete</h2><p className="text-3xl font-semibold">{total.toLocaleString()} / 10,000</p><ol className="list-inside list-decimal space-y-2">{puzzle.artifacts.map((a,i) => <li key={a.id}>{a.title} · {guesses[i]?.total ?? 0} points</li>)}</ol><p>{isPracticeResult('anthropeum', dailyDay) ? 'Future preview · practice only.' : 'Saved to your daily scores.'}</p></section>
  return <section className="space-y-4" data-testid="anthropeum-play">
    <div className="flex justify-between"><h2 className="font-semibold">Artifact {round + 1} / {puzzle.artifacts.length}</h2><p className="tabular-nums">{total.toLocaleString()} points</p></div>
    <div className="flex min-h-56 items-center justify-center rounded-xl border bg-white p-3">
      {failedImage ? <p>Image unavailable. Try another photo using the button below.</p> : /* Museum image URLs are externally hosted and have varying sizes. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img key={artifact.id+':'+image} src={artifact.images[image]} alt={guess ? artifact.title : `Mystery artifact ${round+1}`} className="max-h-80 max-w-full object-contain" onError={() => setFailedImage(true)} />}
    </div>
    {artifact.images.length > 1 && <button className="text-sm underline" onClick={() => { setImage(i => (i+1)%artifact.images.length); setFailedImage(false) }}>Another photo ({image+1}/{artifact.images.length})</button>}
    {guess && detail ? <div className="space-y-3 rounded-lg border p-4" role="status"><h3 className="font-semibold">{artifact.title}</h3><p>{artifact.culture} · {artifact.objectDate}</p><p>Location: {detail.location}/500 · {detail.km === 0 ? 'inside the historical region' : `about ${detail.km.toLocaleString()} km from the historical region`}. Date: {detail.time}/500 · {detail.years} years outside its date range.</p><p>{artifact.description}</p><a className="underline" href={artifact.metUrl} target="_blank" rel="noreferrer">Museum record ↗</a><button className="block rounded-lg bg-[var(--ink-accent)] px-5 py-2 text-white" onClick={() => { setRound(r => r+1); setPin(null); setYear(1000); setImage(0); setFailedImage(false) }}>Next artifact →</button></div> : <>
      <p>Where was this made? Place your pin, then choose a year.</p>
      <MapPicker pin={pin} onChange={setPin} />
      <div className="flex flex-wrap gap-3"><label className="text-sm">Latitude<input aria-label="Latitude" className="ml-2 w-24 rounded border bg-[var(--ink-paper)] p-2" type="number" min={-85} max={85} step="0.1" value={pin?.lat ?? ''} onChange={e => setPin(p => ({ lat: Math.max(-85,Math.min(85,Number(e.target.value))), lon: p?.lon ?? 0 }))} /></label><label className="text-sm">Longitude<input aria-label="Longitude" className="ml-2 w-24 rounded border bg-[var(--ink-paper)] p-2" type="number" min={-180} max={180} step="0.1" value={pin?.lon ?? ''} onChange={e => setPin(p => ({ lon: Math.max(-180,Math.min(180,Number(e.target.value))), lat: p?.lat ?? 0 }))} /></label></div>
      <label className="block">Year <strong>{year < 0 ? `${-year} BCE` : `${year} CE`}</strong><input className="my-3 block w-full accent-[var(--ink-accent)]" aria-label="Year slider" type="range" min={-5000} max={2026} step={1} value={year} onChange={e => setYear(Number(e.target.value))} /></label>
      <label className="block text-sm">Exact year (negative = BCE)<input aria-label="Exact year" type="number" min={-10000} max={2026} value={year} onChange={e => setYear(Math.max(-10000,Math.min(2026,Number(e.target.value))))} className="ml-2 w-28 rounded border bg-[var(--ink-paper)] p-2" /></label>
      <button disabled={!pin} className="rounded-lg bg-[var(--ink-accent)] px-5 py-3 text-white disabled:opacity-40" onClick={() => { if (pin) { markPracticeIfFuture('anthropeum', dailyDay); const total = artifactScore(artifact,pin,year).total; setGuesses(previous => [...previous,{pin,year,total}]) } }}>Lock in guess</button>
    </>}
    {guess && <MapPicker pin={guess.pin} onChange={() => {}} target={artifact.target} />}
    <p className="text-xs text-[var(--ink-muted)]">Museum artifacts from Anthropeum’s public daily set. This on-site version uses historical origin regions and local scoring, separate from the official game.</p>
  </section>
}
