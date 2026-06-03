'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { WeddingData } from '@/data/wedding/madelyn-patrick'
import { WeddingSection } from '@/components/wedding/WeddingSection'

type WeddingGalleryProps = {
  wedding: WeddingData
}

function GalleryItem({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false)
  if (err) return null
  return (
    <div className="overflow-hidden">
      <Image
        src={src}
        alt={alt}
        width={600}
        height={600}
        className="aspect-square w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
        loading="lazy"
        onError={() => setErr(true)}
      />
    </div>
  )
}

export function WeddingGallery({ wedding }: WeddingGalleryProps) {
  if (wedding.gallery.length === 0) return null

  return (
    <WeddingSection id="photos" title="Photos">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1.5">
        {wedding.gallery.map((photo, i) => (
          <GalleryItem key={i} src={photo.src} alt={photo.alt} />
        ))}
      </div>
    </WeddingSection>
  )
}
