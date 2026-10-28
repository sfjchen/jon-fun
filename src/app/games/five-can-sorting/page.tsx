'use client'

import dynamic from 'next/dynamic'

/* Client-only: the hidden can order is random, so a server render would never match hydration. */
const FiveCanGame = dynamic(() => import('@/components/FiveCanGame'), { ssr: false })

export default function FiveCanSortingPage() {
  return <FiveCanGame />
}
