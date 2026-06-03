'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { WeddingData } from '@/data/wedding/madelyn-patrick'
import { WeddingSection } from '@/components/wedding/WeddingSection'

type WeddingStoryProps = {
  wedding: WeddingData
}

function StoryPhoto({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false)
  if (err) return null
  return (
    <div className="overflow-hidden">
      <Image src={src} alt={alt} width={800} height={600} className="aspect-[4/3] w-full object-cover" onError={() => setErr(true)} />
    </div>
  )
}

export function WeddingStory({ wedding }: WeddingStoryProps) {
  return (
    <WeddingSection id="story" title={wedding.story.title}>
      <div className="space-y-5 text-base leading-[1.75]" style={{ color: 'var(--wedding-text)' }}>
        {wedding.story.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {wedding.story.photos.length > 0 && (
        <div className="mt-10 grid gap-1 sm:grid-cols-2">
          {wedding.story.photos.map((photo, i) => (
            <StoryPhoto key={i} src={photo.src} alt={photo.alt} />
          ))}
        </div>
      )}
    </WeddingSection>
  )
}
