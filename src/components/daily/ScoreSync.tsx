'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { flushResults, getPlayer, pendingResults, PLAYER_CHANGED, RESULTS_CHANGED } from '@/lib/results'
export default function ScoreSync() {
  const [status, setStatus] = useState('')
  useEffect(() => {
    const refresh = () => setStatus(!getPlayer() ? 'Set your name and group to sync scores' : pendingResults() ? 'Score saved on this device · sync pending' : 'Daily scores sync to your group')
    const sync = () => { void flushResults().then(refresh) }
    refresh(); sync()
    const events = ['online', 'focus', PLAYER_CHANGED, RESULTS_CHANGED, 'sfjc-score-queued', 'storage']
    events.forEach(e => window.addEventListener(e, e === 'online' || e === 'focus' ? sync : refresh))
    const timer = setInterval(sync, 15000)
    return () => { clearInterval(timer); events.forEach(e => window.removeEventListener(e, e === 'online' || e === 'focus' ? sync : refresh)) }
  }, [])
  return <Link href="/leaderboards" className="block text-sm underline underline-offset-4" data-testid="score-sync">{status || 'Scores & friends'} →</Link>
}
