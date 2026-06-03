import type { WeddingEvent } from '@/data/wedding/madelyn-patrick'
import { mapsAppleUrl, mapsGoogleUrl } from '@/data/wedding/madelyn-patrick'

type WeddingTimelineProps = {
  events: WeddingEvent[]
}

export function WeddingTimeline({ events }: WeddingTimelineProps) {
  return (
    <div className="relative space-y-0">
      {events.map((ev, idx) => {
        const query = ev.mapsQuery ?? ev.address
        const isLast = idx === events.length - 1
        return (
          <article key={ev.id} className="relative flex gap-5 pb-10 sm:gap-8 sm:pb-12">
            {!isLast && (
              <span
                className="absolute left-[7px] top-3 h-[calc(100%-0.5rem)] w-px sm:left-[9px]"
                style={{ backgroundColor: 'var(--wedding-border)' }}
                aria-hidden="true"
              />
            )}
            <div
              className="relative z-10 mt-1.5 h-4 w-4 shrink-0 rounded-full border-2 sm:h-[18px] sm:w-[18px]"
              style={{ borderColor: 'var(--wedding-accent)', backgroundColor: 'var(--wedding-bg)' }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 pb-2">
              <p className="wedding-eyebrow text-left">{ev.label}</p>
              <p className="font-wedding-display mt-2 text-xl font-normal tracking-tight sm:text-2xl">{ev.venue}</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--wedding-accent-dark)' }}>
                {ev.time}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--wedding-muted)' }}>
                {ev.address}
              </p>
              {ev.description && (
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--wedding-muted)' }}>
                  {ev.description}
                </p>
              )}
              {query && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href={mapsGoogleUrl(query)} target="_blank" rel="noopener noreferrer" className="wedding-btn-outline">
                    Google Maps
                  </a>
                  <a href={mapsAppleUrl(query)} target="_blank" rel="noopener noreferrer" className="wedding-btn-ghost">
                    Apple Maps
                  </a>
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
