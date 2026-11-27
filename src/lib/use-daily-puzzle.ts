'use client'

import { useEffect, useState } from 'react'
import { siteDay } from '@/lib/daily'
import type { GameId } from '@/lib/results'

type Daily<T> = { day: string; sourceDate: string; puzzle: T }

/** Retry temporary source errors on today's puzzle while keeping the selected date fixed. */
export function useDailyPuzzle<T = unknown>(game: GameId, day: string) {
  const key = `${game}:${day}`
  const [response, setResponse] = useState<{ key: string; data?: Daily<T>; error?: string }>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const r = await fetch(`/api/daily/${game}?d=${day}`, { signal: controller.signal })
        const data = await r.json()
        if (!r.ok) throw Error(data.error ?? 'Could not load puzzle')
        if (data.day !== day || data.sourceDate !== day) throw Error('The source has not published this puzzle yet.')
        if (!controller.signal.aborted) setResponse({ key, data })
      } catch (error) {
        if (controller.signal.aborted) return
        setResponse({ key, error: error instanceof Error ? error.message : 'Could not load puzzle' })
        if (day === siteDay()) timer = setTimeout(load, 60000)
      }
    }
    void load()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [key, game, day, attempt])

  return {
    ...(response?.key === key ? response : undefined),
    retry: () => {
      setResponse(undefined)
      setAttempt((value) => value + 1)
    },
  }
}
