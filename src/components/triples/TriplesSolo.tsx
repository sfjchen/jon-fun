'use client'

/**
 * Plays Triples alone against the clock: clear the 81-card deck, with hints and a saved best time.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import TriplesBoard from '@/components/triples/TriplesBoard'
import { brokenFeatures, findTriple, isOver, isTriple, newDeal, removeTriple, type Deal } from '@/lib/triples'
import { formatTime } from '@/lib/results'
import { useHotkeys } from '@/lib/keyboard'

const BEST_KEY = 'triples_best_seconds'
const pill = 'rounded-full border px-4 py-2 text-sm font-semibold active:scale-95 disabled:opacity-40'

/**
 * Reads the saved best clear time in seconds, or 0.
 */
function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

/**
 * Renders the solo game. The first deal happens in the browser so the server and client markup match.
 */
export default function TriplesSolo() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [hinted, setHinted] = useState<number[]>([])
  const [found, setFound] = useState(0)
  const [hints, setHints] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [endedAt, setEndedAt] = useState(0)
  const [now, setNow] = useState(0)
  const [msg, setMsg] = useState('')
  const [shake, setShake] = useState(false)
  const [best, setBest] = useState(0)

  /** Starts a new game. `at` is 0 during the first render; the clock tick then fills in the start time. */
  const restart = useCallback((at: number) => {
    setDeal(newDeal())
    setSelected([])
    setHinted([])
    setFound(0)
    setHints(0)
    setStartedAt(at)
    setNow(at)
    setEndedAt(0)
    setMsg('')
    setBest(readBest())
  },[])
  useEffect(()=>{if(hydrated&&!deal)queueMicrotask(()=>restart(Date.now()))},[hydrated,deal,restart])

  useEffect(() => {
    if (endedAt) return
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      setStartedAt((s) => s || n)
    }, 500)
    return () => clearInterval(t)
  }, [endedAt])

  /** Highlights 1 more card of a set on the table, up to all 3. */
  const hint = () => {
    const t = deal && findTriple(deal.board)
    if (!t) return
    setHints((h) => h + 1)
    setHinted(t.slice(0, Math.min(3, hinted.length + 1)))
  }
  // H hints, Backspace or Escape clears the picked cards, and Enter deals again once the deck is cleared.
  useHotkeys((k) => {
    if (endedAt) return k === 'Enter' ? (restart(Date.now()), true) : false
    if (k === 'h' || k === '?') return hint(), true
    if (k === 'Backspace' || k === 'Escape') return setSelected([]), true
  })

  if (!deal) return <p style={{ color: 'var(--ink-muted)' }}>Dealing…</p>

  const seconds = Math.max(0, Math.floor(((endedAt || now || startedAt) - startedAt) / 1000))

  const pick = (card: number) => {
    if (endedAt || shake) return
    const next = selected.includes(card) ? selected.filter((c) => c !== card) : [...selected, card]
    if (next.length < 3) return setSelected(next)
    if (isTriple(next[0]!, next[1]!, next[2]!)) {
      const after = removeTriple(deal, next)
      setDeal(after)
      setFound((f) => f + 1)
      setSelected([])
      setHinted([])
      setMsg('Set!')
      if (isOver(after)) {
        const end = Date.now()
        const took = Math.floor((end - startedAt) / 1000)
        setEndedAt(end)
        if (!hints && (!best || took < best)) {
          setBest(took)
          try {
            localStorage.setItem(BEST_KEY, String(took))
          } catch {}
        }
      }
      return
    }
    setSelected(next)
    setShake(true)
    setMsg(`Not a set: check ${brokenFeatures(next).join(', ')}`)
    setTimeout(() => {
      setShake(false)
      setSelected([])
    }, 450)
  }


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm" style={{ color: 'var(--ink-muted)' }}>
        <span className="tabular-nums" title="Time">
          ⏱ {formatTime(seconds)}
        </span>
        <span title="Sets found">{found} found</span>
        <span title="Cards left to deal">{deal.deck.length} in deck</span>
      </div>
      <p role="status" className="h-5 text-center text-sm font-medium">
        {msg}
      </p>
      <TriplesBoard board={deal.board} selected={selected} hinted={hinted} shake={shake} disabled={!!endedAt||shake} onPick={pick} />
      {endedAt ? (
        <div className="space-y-2 text-center">
          <p className="font-lora text-xl font-semibold">Deck cleared in {formatTime(seconds)}</p>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {found} sets · {hints} hint{hints === 1 ? '' : 's'}
            {best ? ` · best ${formatTime(best)} (no hints)` : ''}
          </p>
          <button className={pill} style={{ borderColor: 'currentColor' }} onClick={() => restart(Date.now())}>
            New game
          </button>
        </div>
      ) : (
        <div className="flex justify-center gap-2">
          <button className={pill} style={{ borderColor: 'currentColor' }} title="Highlights a card from a triple; tap again for more" onClick={hint}>
            Hint
          </button>
          <button className={pill} style={{ borderColor: 'currentColor' }} onClick={() => restart(Date.now())}>
            New game
          </button>
        </div>
      )}
      {best > 0 && !endedAt && (
        <p className="text-center text-xs" style={{ color: 'var(--ink-muted)' }}>
          Best clear without hints: {formatTime(best)}
        </p>
      )}
    </div>
  )
}
