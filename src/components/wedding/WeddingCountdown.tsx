'use client'

import { useEffect, useState } from 'react'

type WeddingCountdownProps = {
  dateIso: string
}

type Parts = { days: number; hours: number; minutes: number }

function diffParts(target: Date, now: Date): Parts | null {
  const ms = target.getTime() - now.getTime()
  if (ms <= 0) return null
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return { days, hours, minutes }
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-center px-2 sm:min-w-[5rem] sm:px-3">
      <span className="font-wedding-display text-3xl font-light tabular-nums tracking-tight sm:text-4xl">{value}</span>
      <span className="wedding-eyebrow mt-1 text-[0.65rem]">{label}</span>
    </div>
  )
}

export function WeddingCountdown({ dateIso }: WeddingCountdownProps) {
  const [parts, setParts] = useState<Parts | null>(null)
  const [past, setPast] = useState(false)

  useEffect(() => {
    const target = new Date(`${dateIso}T16:00:00`)
    const tick = () => {
      const now = new Date()
      const p = diffParts(target, now)
      if (!p) {
        setPast(true)
        setParts(null)
        return
      }
      setPast(false)
      setParts(p)
    }
    tick()
    const id = window.setInterval(tick, 60000)
    return () => window.clearInterval(id)
  }, [dateIso])

  if (past) {
    return (
      <p className="wedding-eyebrow mt-8" style={{ color: 'var(--wedding-accent)' }}>
        See you soon
      </p>
    )
  }

  if (!parts) return null

  return (
    <div className="mt-8 flex items-center justify-center" role="timer" aria-live="polite">
      <CountdownUnit value={parts.days} label="Days" />
      <span className="font-wedding-display text-2xl font-light opacity-40" aria-hidden="true">
        ·
      </span>
      <CountdownUnit value={parts.hours} label="Hours" />
      <span className="font-wedding-display text-2xl font-light opacity-40" aria-hidden="true">
        ·
      </span>
      <CountdownUnit value={parts.minutes} label="Min" />
    </div>
  )
}
