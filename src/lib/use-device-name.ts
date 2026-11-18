'use client'
import { useState, useSyncExternalStore } from 'react'
import { getDevicePlayer, PLAYER_IDENTITY_CHANGED } from '@/lib/syncIdentity'
function subscribe(cb:()=>void){window.addEventListener(PLAYER_IDENTITY_CHANGED,cb);return()=>window.removeEventListener(PLAYER_IDENTITY_CHANGED,cb)}
/** An untouched join field follows the device name, including a cookie restoration. */
export function useDeviceName(){
  const name=useSyncExternalStore(subscribe,()=>getDevicePlayer()?.name??'',()=> '')
  const [draft,setDraft]=useState<string|null>(null)
  return [draft??name,setDraft] as const
}
