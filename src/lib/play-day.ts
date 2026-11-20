'use client'

/**
 * Open daily pages follow the Pacific calendar. A run started before midnight keeps its puzzle and result date.
 * A reload in the hour after midnight also resumes yesterday's game when the player was still mid-game.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { nextSiteMidnight, shiftDay, siteDay } from '@/lib/daily'
import { PLAYING_KEY, type GameId } from '@/lib/results'

const RESUME_MS = 3600000

function subscribeDay(update: () => void) {
  let timer: ReturnType<typeof setTimeout>
  function refresh() {
    clearTimeout(timer)
    update()
    timer = setTimeout(refresh, Math.max(0, nextSiteMidnight() - Date.now()) + 50)
  }
  refresh()
  window.addEventListener('pageshow', refresh)
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  return () => {
    clearTimeout(timer)
    window.removeEventListener('pageshow', refresh)
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
  }
}

export function useSiteDay() {
  return useSyncExternalStore(subscribeDay, siteDay, () => '')
}

/** Explicit dates stay fixed. Idle and completed games follow today's puzzle on the bare path. */
export function usePlayDay(requested: string | null, game?: GameId | 'set'): string {
  const today = useSiteDay()
  const [pin, setPin] = useState(() => {
    const today = siteDay()
    let day = today
    try {
      const mark = game && JSON.parse(localStorage.getItem(PLAYING_KEY + game) ?? 'null')
      if (mark?.day === shiftDay(day, -1) && Date.now() - mark.at < RESUME_MS) day = mark.day
    } catch {
      /* Storage can be disabled on the server or in a private browser. */
    }
    return { requested, today, day: requested ?? day }
  })
  let day = requested ?? (today ? pin.day : siteDay())
  if (pin.requested !== requested || (today && pin.today !== today)) {
    let keepRun = false
    try {
      const mark = game && JSON.parse(localStorage.getItem(PLAYING_KEY + game) ?? 'null')
      keepRun = Boolean(mark?.day === pin.day && mark.at && pin.day === shiftDay(today, -1))
    } catch {}
    day = requested ?? (pin.requested === requested && keepRun ? pin.day : today || siteDay())
    setPin({ requested, today: today || siteDay(), day })
  }
  useEffect(() => {
    if (!game) return
    let last = 0
    const mark = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('header')) return
      if (Date.now() - last < 30000) return
      try {
        const prev = JSON.parse(localStorage.getItem(PLAYING_KEY + game) ?? 'null')
        // A finished game (at 0) stays finished, so clicks on its result screen never make a reload resume it.
        if (prev?.day !== day || prev.at)
          localStorage.setItem(PLAYING_KEY + game, JSON.stringify({ day, at: (last = Date.now()) }))
      } catch {
        /* Storage can be disabled in a private browser. */
      }
    }
    const events = ['keydown', 'pointerdown']
    for (const e of events) window.addEventListener(e, mark, true)
    return () => {
      for (const e of events) window.removeEventListener(e, mark, true)
    }
  }, [game, day])
  return day
}
