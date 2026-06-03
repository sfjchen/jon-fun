'use client'

import { useState } from 'react'
import type { WeddingData } from '@/data/wedding/madelyn-patrick'
import { WeddingSection } from '@/components/wedding/WeddingSection'

type WeddingLogisticsProps = {
  wedding: WeddingData
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-b py-6 first:pt-0 last:border-b-0" style={{ borderColor: 'var(--wedding-border)' }}>
      <h3 className="wedding-label">{title}</h3>
      <p className="mt-3 text-sm leading-[1.75]" style={{ color: 'var(--wedding-muted)' }}>
        {body}
      </p>
    </div>
  )
}

export function WeddingLogistics({ wedding }: WeddingLogisticsProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const { logistics } = wedding

  return (
    <WeddingSection id="logistics" title="Logistics" subtitle="Everything you need before the big day">
      <InfoBlock title="Dress code" body={logistics.dressCode} />
      <InfoBlock title="Parking & transportation" body={logistics.parking} />
      <InfoBlock title="Where to stay" body={logistics.hotels} />

      <div className="mt-16">
        <h3 className="wedding-title text-center text-2xl">FAQ</h3>
        <div className="wedding-divider mx-auto mt-5" aria-hidden="true">
          <span />
          <span className="wedding-divider-mark">◆</span>
          <span />
        </div>
        <div className="mt-8 divide-y" style={{ borderColor: 'var(--wedding-border)' }}>
          {wedding.faq.map((item, idx) => {
            const open = openIdx === idx
            return (
              <div key={idx} className="border-t first:border-t-0" style={{ borderColor: 'var(--wedding-border)' }}>
                <button
                  type="button"
                  className="flex min-h-[52px] w-full items-center justify-between gap-4 py-4 text-left"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  aria-expanded={open}
                >
                  <span className="text-sm leading-snug" style={{ color: 'var(--wedding-text)' }}>
                    {item.q}
                  </span>
                  <span className="wedding-eyebrow shrink-0 !text-[0.6rem]" style={{ color: 'var(--wedding-accent)' }}>
                    {open ? 'Close' : 'Open'}
                  </span>
                </button>
                {open && (
                  <p className="pb-5 text-sm leading-[1.75]" style={{ color: 'var(--wedding-muted)' }}>
                    {item.a}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {logistics.contactEmail && (
        <p className="mt-10 text-center text-sm" style={{ color: 'var(--wedding-muted)' }}>
          Questions?{' '}
          <a href={`mailto:${logistics.contactEmail}`} className="underline underline-offset-2" style={{ color: 'var(--wedding-accent-dark)' }}>
            {logistics.contactEmail}
          </a>
        </p>
      )}
    </WeddingSection>
  )
}
