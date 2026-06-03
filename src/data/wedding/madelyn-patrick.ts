/**
 * Madelyn & Patrick wedding site content — edit this file to update the public site.
 *
 * Still needed from Madelyn/Patrick (replace TBD / null placeholders):
 * - Ceremony + reception venue names, addresses, start times
 * - Venmo handles (registry.venmo.bride / groom)
 * - hero.jpg + gallery photos in public/images/wedding/madelyn-patrick/
 * - Love story paragraphs
 * - Dress code, parking, hotel blocks, contact email
 * - Plus-one / kids policy (FAQ)
 */
export type WeddingEvent = {
  id: string
  label: string
  time: string
  venue: string
  address: string
  description?: string
  mapsQuery?: string
}

export type WeddingFaq = {
  q: string
  a: string
}

export type WeddingData = {
  slug: string
  couple: { bride: string; groom: string; brideShort: string; groomShort: string }
  date: string
  displayDate: string
  city: string
  tagline: string
  heroPhoto: { src: string; alt: string }
  bios: { bride: string; groom: string }
  events: WeddingEvent[]
  story: {
    title: string
    paragraphs: string[]
    photos: Array<{ src: string; alt: string }>
  }
  registry: {
    message: string
    submessage: string
    venmo: { bride: string | null; groom: string | null }
  }
  logistics: {
    dressCode: string
    parking: string
    hotels: string
    contactEmail: string | null
  }
  faq: WeddingFaq[]
  gallery: Array<{ src: string; alt: string }>
  rsvpDeadline: string
  rsvpDeadlineDisplay: string
  nav: Array<{ id: string; label: string }>
}

export const madelynPatrickWedding: WeddingData = {
  slug: 'madelyn-patrick',
  couple: {
    bride: 'Madelyn Chen',
    groom: 'Patrick Ng',
    brideShort: 'Madelyn',
    groomShort: 'Patrick',
  },
  date: '2026-11-28',
  displayDate: 'Saturday, November 28, 2026',
  city: 'San Francisco, California',
  tagline: 'Together with their families, Madelyn and Patrick joyfully invite you to celebrate their wedding in San Francisco.',
  heroPhoto: {
    src: '/images/wedding/madelyn-patrick/hero.jpg',
    alt: 'Madelyn and Patrick — San Francisco celebration (placeholder photo)',
  },
  bios: {
    bride: 'Harvard Law Graduate',
    groom: 'Harvard Medical Graduate',
  },
  events: [
    {
      id: 'ceremony',
      label: 'Ceremony',
      time: 'Details coming soon',
      venue: 'San Francisco, California',
      address: 'Venue to be announced',
      description: 'We will share the ceremony location and start time as soon as plans are finalized.',
      mapsQuery: 'San Francisco, CA',
    },
    {
      id: 'celebration',
      label: 'Celebration',
      time: 'Details coming soon',
      venue: 'Dinner & Reception',
      address: 'San Francisco, California',
      description: 'An elegant evening celebration with family and friends.',
      mapsQuery: 'San Francisco, CA',
    },
  ],
  story: {
    title: 'Our Story',
    paragraphs: [
      'Madelyn and Patrick met in Boston, bonded over long study nights and shorter coffee breaks, and found home in each other’s ambition and kindness.',
      'After years on opposite coasts, they chose San Francisco as the place to begin this next chapter — surrounded by the people who shaped them.',
      'We are grateful for your love and support as we prepare for this celebration.',
    ],
    photos: [
      { src: '/images/wedding/madelyn-patrick/gallery-1.jpg', alt: 'Placeholder — rings on silk' },
      { src: '/images/wedding/madelyn-patrick/gallery-2.jpg', alt: 'Placeholder — table setting' },
    ],
  },
  registry: {
    message:
      'Your presence at our wedding is the greatest gift we could ask for. If you wish to celebrate with a gift, a contribution toward our honeymoon is deeply appreciated.',
    submessage: 'Venmo links will be added here once confirmed.',
    venmo: { bride: null, groom: null },
  },
  logistics: {
    dressCode:
      'Elegant evening attire. Specific dress code details will be updated here as we finalize the venue.',
    parking: 'Parking and transportation details will be posted when the venue is confirmed.',
    hotels: 'Hotel recommendations and room blocks will be shared here for out-of-town guests.',
    contactEmail: null,
  },
  faq: [
    {
      q: 'When is the RSVP deadline?',
      a: 'Please respond by November 1, 2026 so we can finalize catering and seating.',
    },
    {
      q: 'Can I bring a plus-one?',
      a: 'Plus-one availability is indicated on your invitation. If you are unsure, please reach out to us directly.',
    },
    {
      q: 'Are children invited?',
      a: 'We love your little ones — child attendance details will be clarified on your invitation.',
    },
    {
      q: 'Where should I stay?',
      a: 'Hotel and travel recommendations will be posted in the Logistics section as plans are confirmed.',
    },
    {
      q: 'What should I wear?',
      a: 'See the dress code in Logistics. We will update with venue-specific guidance soon.',
    },
    {
      q: 'How do I send a gift?',
      a: 'Registry details are on this site under Registry. Gift information is not included on printed invitations.',
    },
  ],
  gallery: [
    { src: '/images/wedding/madelyn-patrick/gallery-1.jpg', alt: 'Placeholder — rings on silk' },
    { src: '/images/wedding/madelyn-patrick/gallery-2.jpg', alt: 'Placeholder — table setting' },
    { src: '/images/wedding/madelyn-patrick/gallery-3.jpg', alt: 'Placeholder — San Francisco at dusk' },
  ],
  rsvpDeadline: '2026-11-01',
  rsvpDeadlineDisplay: 'November 1, 2026',
  nav: [
    { id: 'details', label: 'Details' },
    { id: 'rsvp', label: 'RSVP' },
    { id: 'registry', label: 'Registry' },
    { id: 'story', label: 'Story' },
  ],
}

export function mapsGoogleUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function mapsAppleUrl(query: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`
}

export function venmoPayUrl(handle: string): string {
  const clean = handle.replace(/^@/, '')
  return `https://venmo.com/?txn=pay&recipients=${encodeURIComponent(clean)}`
}
