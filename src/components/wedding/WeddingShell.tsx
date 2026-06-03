'use client'

import { useEffect, useState } from 'react'
import type { WeddingData } from '@/data/wedding/madelyn-patrick'

type WeddingShellProps = {
  wedding: WeddingData
  children: React.ReactNode
}

export function WeddingShell({ wedding, children }: WeddingShellProps) {
  const [activeId, setActiveId] = useState<string>('')
  const [showStickyRsvp, setShowStickyRsvp] = useState(false)

  useEffect(() => {
    const ids = wedding.nav.map((n) => n.id)
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (els.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-35% 0px -50% 0px', threshold: [0, 0.2, 0.4] }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [wedding.nav])

  useEffect(() => {
    const rsvp = document.getElementById('rsvp')
    if (!rsvp) return
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyRsvp(!entry?.isIntersecting),
      { threshold: 0.15 }
    )
    obs.observe(rsvp)
    return () => obs.disconnect()
  }, [])

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{ borderColor: 'var(--wedding-border)', backgroundColor: 'rgba(250, 246, 240, 0.88)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <a href="#top" className="wedding-eyebrow shrink-0 !text-[0.6rem] !tracking-[0.22em]" style={{ color: 'var(--wedding-text)' }}>
            M &amp; P
          </a>
          <nav className="flex items-center justify-end gap-4 sm:gap-6" aria-label="Wedding sections">
            {wedding.nav.map((item) => {
              const active = activeId === item.id
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="relative min-h-[44px] inline-flex items-center justify-center pb-0.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] transition-colors"
                  style={{
                    fontFamily: 'var(--wedding-sans)',
                    color: active ? 'var(--wedding-text)' : 'var(--wedding-muted)',
                  }}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute bottom-1 left-0 right-0 mx-auto h-px w-full max-w-[2rem]"
                      style={{ backgroundColor: 'var(--wedding-accent)' }}
                    />
                  )}
                </a>
              )
            })}
          </nav>
        </div>
      </header>

      <div id="top">{children}</div>

      {showStickyRsvp && (
        <a href="#rsvp" className="wedding-sticky-rsvp wedding-btn-primary">
          RSVP
        </a>
      )}

      <footer
        className="border-t px-4 py-14 text-center"
        style={{ borderColor: 'var(--wedding-border)', color: 'var(--wedding-muted)' }}
      >
        <p className="wedding-eyebrow">With love</p>
        <p className="font-wedding-display mt-3 text-xl font-light tracking-tight">
          {wedding.couple.bride} &amp; {wedding.couple.groom}
        </p>
        <p className="mt-2 text-sm">{wedding.displayDate}</p>
      </footer>
    </div>
  )
}
