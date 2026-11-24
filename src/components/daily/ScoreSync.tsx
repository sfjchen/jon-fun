'use client'

/**
 * Keeps daily results syncing and shows a one-line note only when the player must act or a sync is pending.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  flushResults,
  getPlayer,
  onLiveRefresh,
  pendingResults,
  PLAYER_CHANGED,
  RESULT_QUEUED,
  RESULTS_CHANGED,
  sendAutocheckedMinis,
} from '@/lib/results'

/**
 * Flushes queued results on load, on return to the page, on reconnect and every 15 seconds, and renders the note.
 */
export default function ScoreSync() {
  const [status, setStatus] = useState('')
  useEffect(() => {
    const refresh = () => setStatus(!getPlayer() ? '' : pendingResults() ? 'Score saved here · syncing…' : '')
    const sync = () => void flushResults().then(refresh)
    sendAutocheckedMinis()
    refresh()
    sync()
    const quiet = [PLAYER_CHANGED, RESULTS_CHANGED, RESULT_QUEUED, 'storage']
    quiet.forEach((e) => window.addEventListener(e, refresh))
    const stop = onLiveRefresh(sync)
    return () => {
      stop()
      quiet.forEach((e) => window.removeEventListener(e, refresh))
    }
  }, [])
  if (!status) return null
  return (
    <Link
      href="/leaderboards"
      className="block text-xs underline underline-offset-4"
      data-testid="score-sync"
      style={{ color: 'var(--ink-muted)' }}
    >
      {status} →
    </Link>
  )
}
