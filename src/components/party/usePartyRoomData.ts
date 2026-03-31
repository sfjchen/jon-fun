'use client'

import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { PartyGameKind } from '@/lib/party/types'

type LoadResult = { ok: true; data: unknown } | { ok: false }

export function usePartyRoomData(
  pin: string | null,
  gameKind: PartyGameKind,
  onData: (data: unknown) => void,
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadRoomData = useCallback(
    async (silent = false, signal?: AbortSignal): Promise<LoadResult> => {
      if (!pin) return { ok: false }
      try {
        const res = await fetch(`/api/party/rooms/${pin}`, signal ? { signal } : undefined)
        const data = await res.json()
        if (!res.ok) return { ok: false }
        onData(data)
        return { ok: true, data }
      } catch {
        if (signal?.aborted) return { ok: false }
        if (!silent) onData(null)
        return { ok: false }
      }
    },
    [pin, onData],
  )

  const scheduleLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const c = new AbortController()
      abortRef.current = c
      void loadRoomData(true, c.signal)
    }, 120)
  }, [loadRoomData])

  useEffect(() => {
    if (!pin) return
    void loadRoomData()

    const chRoom = supabase
      .channel(`party:room:${pin}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_rooms', filter: `pin=eq.${pin}` }, scheduleLoad)
      .subscribe()

    const chPlayers = supabase
      .channel(`party:players:${pin}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_players', filter: `room_pin=eq.${pin}` },
        scheduleLoad,
      )
      .subscribe()

    const extra: ReturnType<typeof supabase.channel>[] = []
    if (gameKind === 'quiplash') {
      extra.push(
        supabase
          .channel(`party:qm:${pin}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'party_quiplash_matchups', filter: `room_pin=eq.${pin}` },
            scheduleLoad,
          )
          .subscribe(),
      )
      extra.push(
        supabase
          .channel(`party:qa:${pin}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'party_quiplash_answers', filter: `room_pin=eq.${pin}` },
            scheduleLoad,
          )
          .subscribe(),
      )
      extra.push(
        supabase.channel(`party:qv:${pin}`).on('postgres_changes', { event: '*', schema: 'public', table: 'party_quiplash_votes' }, scheduleLoad).subscribe(),
      )
      extra.push(
        supabase
          .channel(`party:qf:${pin}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'party_quiplash_final_answers', filter: `room_pin=eq.${pin}` },
            scheduleLoad,
          )
          .subscribe(),
      )
      extra.push(
        supabase
          .channel(`party:qfv:${pin}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'party_quiplash_final_votes', filter: `room_pin=eq.${pin}` },
            scheduleLoad,
          )
          .subscribe(),
      )
    }
    if (gameKind === 'fibbage') {
      extra.push(
        supabase
          .channel(`party:fr:${pin}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'party_fibbage_rounds', filter: `room_pin=eq.${pin}` },
            scheduleLoad,
          )
          .subscribe(),
      )
      extra.push(
        supabase.channel(`party:fl:${pin}`).on('postgres_changes', { event: '*', schema: 'public', table: 'party_fibbage_lies' }, scheduleLoad).subscribe(),
      )
      extra.push(
        supabase.channel(`party:fp:${pin}`).on('postgres_changes', { event: '*', schema: 'public', table: 'party_fibbage_picks' }, scheduleLoad).subscribe(),
      )
      extra.push(
        supabase.channel(`party:flk:${pin}`).on('postgres_changes', { event: '*', schema: 'public', table: 'party_fibbage_likes' }, scheduleLoad).subscribe(),
      )
    }
    if (gameKind === 'eay') {
      extra.push(
        supabase
          .channel(`party:ei:${pin}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'party_eay_intake', filter: `room_pin=eq.${pin}` },
            scheduleLoad,
          )
          .subscribe(),
      )
      extra.push(
        supabase
          .channel(`party:er:${pin}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'party_eay_rounds', filter: `room_pin=eq.${pin}` },
            scheduleLoad,
          )
          .subscribe(),
      )
      extra.push(
        supabase.channel(`party:el:${pin}`).on('postgres_changes', { event: '*', schema: 'public', table: 'party_eay_lies' }, scheduleLoad).subscribe(),
      )
      extra.push(
        supabase.channel(`party:ep:${pin}`).on('postgres_changes', { event: '*', schema: 'public', table: 'party_eay_picks' }, scheduleLoad).subscribe(),
      )
      extra.push(
        supabase.channel(`party:elk:${pin}`).on('postgres_changes', { event: '*', schema: 'public', table: 'party_eay_likes' }, scheduleLoad).subscribe(),
      )
      extra.push(
        supabase
          .channel(`party:efp:${pin}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'party_eay_final_picks', filter: `room_pin=eq.${pin}` },
            scheduleLoad,
          )
          .subscribe(),
      )
      extra.push(
        supabase
          .channel(`party:ef:${pin}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'party_eay_final', filter: `room_pin=eq.${pin}` },
            scheduleLoad,
          )
          .subscribe(),
      )
    }

    const poll = setInterval(() => {
      void loadRoomData(true)
    }, 800)

    return () => {
      chRoom.unsubscribe()
      chPlayers.unsubscribe()
      extra.forEach((c) => c.unsubscribe())
      clearInterval(poll)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [pin, gameKind, loadRoomData, scheduleLoad])

  return { loadRoomData, scheduleLoad }
}
