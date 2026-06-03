'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { WeddingData } from '@/data/wedding/madelyn-patrick'
import { WeddingCountdown } from '@/components/wedding/WeddingCountdown'

type WeddingHeroProps = {
  wedding: WeddingData
}

export function WeddingHero({ wedding }: WeddingHeroProps) {
  const [imgErr, setImgErr] = useState(false)
  const showPhoto = wedding.heroPhoto.src && !imgErr

  return (
    <section className="wedding-reveal pb-16 pt-12 text-center sm:pb-20 sm:pt-16">
      <div className="mx-auto max-w-2xl px-4">
        <p className="wedding-eyebrow">Wedding Celebration</p>
        <h1 className="wedding-hero-title mt-4">
          {wedding.couple.bride}
          <span className="mx-2 block text-[0.45em] font-normal italic sm:inline" style={{ color: 'var(--wedding-accent)' }}>
            &amp;
          </span>
          {wedding.couple.groom}
        </h1>
        <p className="mt-5 text-sm sm:text-base" style={{ color: 'var(--wedding-muted)' }}>
          {wedding.displayDate}
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--wedding-muted)' }}>
          {wedding.city}
        </p>
        <WeddingCountdown dateIso={wedding.date} />
        <a href="#rsvp" className="wedding-btn-primary mt-10">
          RSVP
        </a>
      </div>

      <div className="mx-auto mt-14 w-full max-w-4xl px-0 sm:mt-16 sm:px-4">
        {showPhoto ? (
          <Image
            src={wedding.heroPhoto.src}
            alt={wedding.heroPhoto.alt}
            width={1600}
            height={1000}
            className="aspect-[16/10] w-full object-cover sm:aspect-[3/2]"
            priority
            onError={() => setImgErr(true)}
          />
        ) : (
          <div
            className="flex aspect-[16/10] w-full items-center justify-center px-6 text-center sm:aspect-[3/2]"
            style={{ backgroundColor: 'var(--wedding-paper)', color: 'var(--wedding-muted)' }}
          >
            <p className="max-w-sm text-sm leading-relaxed">
              Couple photo coming soon
              <span className="mt-2 block text-xs opacity-80">Add hero.jpg to public/images/wedding/madelyn-patrick/</span>
            </p>
          </div>
        )}
      </div>

      <p className="mx-auto mt-12 max-w-lg px-4 text-base leading-relaxed sm:mt-14" style={{ color: 'var(--wedding-text)' }}>
        {wedding.tagline}
      </p>
    </section>
  )
}
