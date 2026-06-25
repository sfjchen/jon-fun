'use client'

import { useCallback, useEffect, useState } from 'react'
import { partyFetch, sessionKeys } from '@/lib/party/constants'
import type { PartyGameKind } from '@/lib/party/types'

type SessionPatch = { pin?: string; playerId?: string; hostId?: string | null; playerName?: string }

function fetchError(e: unknown, fallback: string): string {
  if (e instanceof DOMException && e.name === 'AbortError') return 'Request timed out'
  return e instanceof Error ? e.message : fallback
}

/** Shared create/join lobby state + sessionStorage for Quip Clash, Fib It, Enough About You. */
export function usePartyLobby(gameKind: PartyGameKind, onPayload: (data: unknown) => void) {
  const keys = sessionKeys(gameKind)

  const [pinInput, setPinInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [hostId, setHostId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clientReady, setClientReady] = useState(false)

  useEffect(() => {
    setClientReady(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = sessionStorage.getItem(keys.pin) || ''
    const pid = sessionStorage.getItem(keys.playerId) || ''
    const hid = sessionStorage.getItem(keys.hostId) || ''
    const n = sessionStorage.getItem(keys.playerName) || ''
    if (p && pid) {
      setPinInput(p)
      setPlayerId(pid)
      setHostId(hid || null)
      setNameInput(n)
    }
  }, [keys.pin, keys.playerId, keys.hostId, keys.playerName])

  const saveSession = useCallback(
    (d: SessionPatch) => {
      if (typeof window === 'undefined') return
      if (d.pin !== undefined) sessionStorage.setItem(keys.pin, d.pin)
      if (d.playerId !== undefined) sessionStorage.setItem(keys.playerId, d.playerId)
      if (d.hostId !== undefined) sessionStorage.setItem(keys.hostId, d.hostId ?? '')
      if (d.playerName !== undefined) sessionStorage.setItem(keys.playerName, d.playerName)
    },
    [keys.hostId, keys.pin, keys.playerId, keys.playerName],
  )

  const loadOnce = useCallback(
    async (p: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await partyFetch(`/api/party/rooms/${p}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Load failed')
        onPayload(data)
      } catch (e) {
        setError(fetchError(e, 'Load failed'))
      } finally {
        setLoading(false)
      }
    },
    [onPayload],
  )

  const createRoom = useCallback(async () => {
    if (!nameInput.trim()) {
      setError('Name required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await partyFetch('/api/party/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: nameInput.trim(), gameKind }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      setPinInput(data.pin)
      setPlayerId(data.playerId)
      setHostId(data.hostId)
      saveSession({ pin: data.pin, playerId: data.playerId, hostId: data.hostId, playerName: nameInput.trim() })
      await loadOnce(data.pin)
    } catch (e) {
      setError(fetchError(e, 'Create failed'))
    } finally {
      setLoading(false)
    }
  }, [gameKind, loadOnce, nameInput, saveSession])

  const joinRoom = useCallback(async () => {
    if (!nameInput.trim() || pinInput.length !== 4) {
      setError('Name and 4-digit PIN required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await partyFetch(`/api/party/rooms/${pinInput}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', playerName: nameInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Join failed')
      setPlayerId(data.playerId)
      saveSession({ pin: pinInput, playerId: data.playerId, playerName: nameInput.trim() })
      await loadOnce(pinInput)
    } catch (e) {
      setError(fetchError(e, 'Join failed'))
    } finally {
      setLoading(false)
    }
  }, [loadOnce, nameInput, pinInput, saveSession])

  return {
    pinInput,
    setPinInput,
    nameInput,
    setNameInput,
    playerId,
    setPlayerId,
    hostId,
    setHostId,
    error,
    setError,
    loading,
    clientReady,
    createRoom,
    joinRoom,
    loadOnce,
    saveSession,
  }
}
