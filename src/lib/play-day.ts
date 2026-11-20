'use client'

/**
 * Pins the puzzle day a daily game page plays. Today's day is read once when the page opens, so a game started before
 * midnight (Pacific) keeps its puzzle until the player finishes it, and its result logs to the day it started on. A
 * reload in the hour after midnight also resumes yesterday's game when the player was still mid-game.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { shiftDay, siteDay } from '@/lib/daily'
import { PLAYING_KEY, type GameId } from '@/lib/results'

const RESUME_MS = 3600000

/**
 * Returns the day to play: the validated `?d=` day when given, else today pinned for the page's life. Navigating to
 * another day, including back to the bare path, re-reads today. With a game id, input on the page marks that game as
 * in progress (until logResult marks it finished), which lets a reload just after midnight resume it.
 */
export function usePlayDay(requested: string | null, game?: GameId): string {
  const [pin, setPin] = useState(() => {
    let day = siteDay()
    try {
      const mark = game && JSON.parse(localStorage.getItem(PLAYING_KEY + game) ?? 'null')
      if (mark?.day === shiftDay(day, -1) && Date.now() - mark.at < RESUME_MS) day = mark.day
    } catch { /* Storage can be disabled on the server or in a private browser. */ }
    return { requested, day: requested ?? day }
  })
  if (pin.requested !== requested) setPin({ requested, day: requested ?? siteDay() })
  // The hydrating render shows today like the server's HTML did, and the resumed day follows right after.
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false)
  const day = requested ?? (hydrated && pin.requested === requested ? pin.day : siteDay())
  useEffect(() => {
    if (!game) return
    let last = 0
    const mark = () => {
      if (Date.now() - last < 30000) return
      try {
        const prev = JSON.parse(localStorage.getItem(PLAYING_KEY + game) ?? 'null')
        // A finished game (at 0) stays finished, so clicks on its result screen never make a reload resume it.
        if (prev?.day !== day || prev.at)
            localStorage.setItem(PLAYING_KEY + game, JSON.stringify({ day, at: (last = Date.now()) }))
      } catch { /* Storage can be disabled in a private browser. */ }
    }
    const events = ['keydown', 'pointerdown']
    for (const e of events) window.addEventListener(e, mark, true)
    return () => { for (const e of events) window.removeEventListener(e, mark, true) }
  }, [game, day])
  return day
}
