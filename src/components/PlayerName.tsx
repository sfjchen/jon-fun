'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ensureSyncIdentity } from '@/lib/syncIdentity'
import { getPlayer, setPlayer, PLAYER_CHANGED } from '@/lib/results'

export function PencilIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z" /></svg>
}
function subscribe(cb:()=>void) {
  window.addEventListener(PLAYER_CHANGED,cb); window.addEventListener('storage',cb)
  return ()=>{window.removeEventListener(PLAYER_CHANGED,cb);window.removeEventListener('storage',cb)}
}
/** Small, shared name editor. A save immediately applies across the device. */
export default function PlayerName() {
  const raw=useSyncExternalStore(subscribe,()=>JSON.stringify(getPlayer()),()=> 'null')
  const player=JSON.parse(raw) as ReturnType<typeof getPlayer>
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState('')
  const input=useRef<HTMLInputElement>(null)
  useEffect(()=>{void ensureSyncIdentity()},[])
  useEffect(()=>{if(editing){input.current?.focus();input.current?.select()}},[editing])
  if(editing) return <form className="player-name-editor inline-flex max-w-full items-center gap-2 text-sm" onSubmit={e=>{e.preventDefault();if(draft.trim()){setPlayer({name:draft.trim(),group:player?.group??'public'});setEditing(false)}}}>
    <input ref={input} aria-label="Your name" autoComplete="nickname" maxLength={24} required value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setEditing(false)}} className="w-32 min-w-0 rounded border bg-[var(--ink-bg)] px-2 py-1" />
    <button type="submit" className="text-xs font-semibold">Save</button><button type="button" aria-label="Cancel name edit" onClick={()=>setEditing(false)}>×</button>
  </form>
  return <span className="inline-flex min-w-0 items-center gap-1 text-sm" data-testid="device-player-name"><span className="max-w-36 truncate">{player?.name}</span><button type="button" aria-label={player?'Edit your name':'Add your name'} title={player?'Edit your name':'Add your name'} className="inline-flex h-8 w-8 items-center justify-center rounded-full opacity-70 hover:opacity-100 focus-visible:outline-2" onClick={()=>{setDraft(player?.name??'');setEditing(true)}}><PencilIcon /></button></span>
}
