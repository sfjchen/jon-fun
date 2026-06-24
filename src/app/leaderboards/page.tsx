'use client'

import Image from 'next/image'

const notes = [
  'Global leaderboards are parked while sfjc.dev stays focused on a few deeper, lower-friction projects.',
  'Most games already keep local history or room state, which fits the site better than a forced shared profile.',
  'If leaderboards come back later, they should be opt-in and nickname-based instead of account-first.',
]

export default function LeaderboardsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-lora text-2xl font-semibold flex items-center gap-2" style={{ color: 'var(--ink-text)' }}>
        <Image src="/doodles/notebook/leaderboards.svg" alt="" width={32} height={32} className="h-8 w-8" />
        Leaderboards
      </h1>

      <div
        className="rounded-lg border p-[30px]"
        style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
      >
        <div className="mb-[30px]">
          <Image src="/doodles/notebook/coming-soon.svg" alt="" width={64} height={64} className="h-16 w-16" />
        </div>
        <h2 className="mb-[30px] font-lora text-xl font-semibold" style={{ color: 'var(--ink-text)' }}>
          Parked for now
        </h2>
        <p className="mb-[30px]" style={{ color: 'var(--ink-muted)' }}>
          This page is intentionally on ice while the site doubles down on a smaller set of stronger projects.
        </p>
        <ul className="mb-[30px] space-y-[30px]" style={{ color: 'var(--ink-text)' }}>
          {notes.map((note, index) => (
            <li key={index} className="flex items-center">
              <span className="mr-2" style={{ color: 'var(--ink-accent)' }}>✓</span>
              {note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
