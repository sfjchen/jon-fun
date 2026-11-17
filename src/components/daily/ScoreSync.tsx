'use client'

/**
 * Keeps daily results syncing and shows a one-line note only when the player must act or a sync is pending.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { flushResults, getPlayer, pendingResults, PLAYER_CHANGED, RESULTS_CHANGED } from '@/lib/results'

/**
 * Flushes queued results on load, focus, reconnect and every 15 seconds, and renders the note.
 */
export default function ScoreSync() {
  const [status, setStatus] = useState('')
  useEffect(() => {
    const refresh = () =>
      setStatus(!getPlayer() ? 'Add your name to rank on the leaderboard' : pendingResults() ? 'Score saved here · syncing…' : '')
    const sync = () => void flushResults().then(refresh)
    refresh()
    sync()
    const quiet = [PLAYER_CHANGED, RESULTS_CHANGED, 'sfjc-score-queued', 'storage']
    quiet.forEach((e) => window.addEventListener(e, refresh))
    window.addEventListener('online', sync)
    window.addEventListener('focus', sync)
    const timer = setInterval(sync, 15000)
    return () => {
      clearInterval(timer)
      quiet.forEach((e) => window.removeEventListener(e, refresh))
      window.removeEventListener('online', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])
  if (!status) return null
  return (
    <Link href="/leaderboards" className="block text-xs underline underline-offset-4" data-testid="score-sync" style={{ color: 'var(--ink-muted)' }}>
      {status} →
    </Link>
  )
}
