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
 * A normal save syncs within a second, so the note appears only after a pass that left a result behind, and a
 * score with no name to file it under asks for one.
 */
export default function ScoreSync() {
  const [status, setStatus] = useState('')
  useEffect(() => {
    const NAME = 'Add your name to save this score',
      RETRY = 'Score saved here · sync will retry'
    // Between passes the note only clears or asks for a name, so a save in flight never flashes the retry note.
    const settle = () => setStatus((s) => (!pendingResults() ? '' : !getPlayer() ? NAME : s === RETRY ? s : ''))
    // A finished pass that left a result behind shows the retry note.
    const sync = () =>
      void flushResults().then((done) => {
        if (done) setStatus(!pendingResults() ? '' : getPlayer() ? RETRY : NAME)
      })
    sendAutocheckedMinis()
    settle()
    sync()
    const quiet = [PLAYER_CHANGED, RESULTS_CHANGED, RESULT_QUEUED, 'storage']
    quiet.forEach((e) => window.addEventListener(e, settle))
    const stop = onLiveRefresh(sync)
    return () => {
      stop()
      quiet.forEach((e) => window.removeEventListener(e, settle))
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
